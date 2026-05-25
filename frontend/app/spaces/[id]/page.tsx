"use client";

import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  spaces as spacesApi,
  type Space,
  type SpaceFile,
  type ApiError,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { MODELS, type Locale } from "../../i18n";
import { I } from "../../icons";
import { Modal } from "../../components/Modal";
import { AssistantMessage, type Citation } from "../../components/AssistantMessage";
import { usePrefs, prefs } from "../../lib/store";
import "../spaces.css";

// Space detail — Claude Projects-style layout.
//
// Two columns:
//   Left  : header chrome + chat composer + empty-state placeholder.
//   Right : Instructions panel (editable) + Files panel with drag-drop upload.
//
// The composer reuses /api/chat with `spaceContext` (top-k chunks) and
// `spaceName` so the agent grounds its reply in this space's files. We also
// pass the space's instructions as a system-prompt prefix.
export default function SpaceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params?.id || "");
  const router = useRouter();
  const { user, loading } = useAuth();
  const [space, setSpace] = useState<Space | null>(null);
  const [files, setFiles] = useState<SpaceFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  function refresh() {
    Promise.all([spacesApi.get(id), spacesApi.files(id)])
      .then(([sp, fs]) => { setSpace(sp); setFiles(fs); })
      .catch((e: ApiError) => setError(e.error || String(e)));
  }
  useEffect(() => {
    if (loading || !user || !id) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, id]);

  // Close the ⋮ dropdown when clicking outside.
  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  async function deleteSpace() {
    if (!space) return;
    if (!confirm(`Delete "${space.name}" and all its files?`)) return;
    try {
      await spacesApi.remove(space.id);
      router.push("/spaces");
    } catch (e: any) {
      setError(e?.error || String(e));
    }
  }

  if (loading || (!space && !error)) {
    return <div className="spaces-shell"><p className="lead">Loading…</p></div>;
  }
  if (!user) return <div className="spaces-shell"><p className="lead">Sign in to view this space.</p></div>;
  if (error && !space) return <div className="spaces-shell"><p className="lead">{error}</p></div>;
  if (!space) return null;

  // Letter fallback for the header icon (matches the directory cards).
  let h = 0;
  for (let i = 0; i < space.name.length; i++) h = (h * 31 + space.name.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;

  return (
    <div className="space-detail-shell">
      <div className="sd-topbar">
        <Link href="/spaces" className="sd-back">← All spaces</Link>
      </div>

      <div className="sd-header">
        {space.icon ? (
          <span className="sd-icon" aria-hidden="true">{space.icon}</span>
        ) : (
          <span
            className="sd-icon sd-icon-letter"
            aria-hidden="true"
            style={{
              background: `hsl(${hue}, 55%, 35%)`,
              color: `hsl(${hue}, 80%, 92%)`,
            }}
          >
            {(space.name.trim()[0] || "?").toUpperCase()}
          </span>
        )}
        <div className="sd-title-block">
          <div className="sd-title">{space.name}</div>
          {space.description && <div className="sd-desc">{space.description}</div>}
        </div>
        <div className="sd-header-actions" ref={menuRef}>
          <button
            className="sd-icon-btn"
            type="button"
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            data-active={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >⋮</button>
          {menuOpen && (
            <div className="sd-menu" role="menu">
              <button
                type="button"
                className="sd-menu-item danger"
                onClick={() => { setMenuOpen(false); deleteSpace(); }}
              >
                Delete space
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="sd-error">{error}</div>
      )}

      <div className="sd-grid">
        <div className="sd-main">
          <SpaceChat space={space} files={files} onFilesChanged={refresh} />
        </div>
        <div className="sd-side">
          <InstructionsPanel space={space} onSaved={(sp) => setSpace(sp)} />
          <FilesPanel
            spaceId={id}
            files={files}
            onChange={refresh}
            onError={setError}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Space chat shell ───────────────────────────────────────────────────────
// Full Claude-Projects-style chat inside the space: scrollable transcript on
// top, docked composer at the bottom. The composer is a sibling of the
// transcript scroller (not a child), same pattern as the dashboard, so the
// dock never floats mid-conversation. On send we stream from /api/chat/stream
// — same SSE protocol the dashboard uses — and the assistant turn grows
// token-by-token in the transcript. spaceContext + spaceName + instructions
// are wired through so the model is grounded in this space's files.
type SpaceChatMessage =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "assistant"; content: string; citations?: Citation[] }
  | { id: string; role: "loading" };

let __spaceIdCounter = 0;
function spaceNewId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  __spaceIdCounter = (__spaceIdCounter + 1) | 0;
  return `${Date.now().toString(36)}-${__spaceIdCounter.toString(36)}`;
}

function SpaceChat({ space, files, onFilesChanged }: { space: Space; files: SpaceFile[]; onFilesChanged: () => void }) {
  const [messages, setMessages] = useState<SpaceChatMessage[]>([]);
  const isChatting = messages.length > 0;
  return (
    <div className="sd-chat" data-chatting={isChatting}>
      {isChatting ? (
        <SpaceTranscript messages={messages} />
      ) : (
        <div className="sd-chat-empty">
          <div className="sd-chat-empty-title">
            Start a chat to keep conversations organized and re-use{" "}
            <strong style={{ color: "var(--ink)" }}>{space.name}</strong> knowledge.
          </div>
          <div className="sd-chat-empty-hint">
            Files dropped on the right are auto-indexed and surfaced as context
            when relevant.
          </div>
        </div>
      )}
      <SpaceChatComposer
        space={space}
        files={files}
        messages={messages}
        setMessages={setMessages}
        onFilesChanged={onFilesChanged}
      />
    </div>
  );
}

function SpaceTranscript({ messages }: { messages: SpaceChatMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  // Auto-scroll only when the user is already at the bottom — same lock the
  // dashboard transcript uses so reading earlier output doesn't fight the
  // stream.
  const stickRef = useRef(true);
  useEffect(() => {
    const scroller = endRef.current?.closest(".sd-chat-scroll") as HTMLElement | null;
    if (!scroller) return;
    function onScroll() {
      if (!scroller) return;
      const dist = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      stickRef.current = dist < 120;
    }
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (!stickRef.current) return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="sd-chat-scroll">
      <div className="transcript">
        {messages.map((m) => {
          if (m.role === "loading") {
            return (
              <div key={m.id} className="msg msg-assistant msg-loading">
                <img
                  src="/babagemed-icon.png"
                  alt=""
                  className="msg-loading-mark"
                  width={40}
                  height={40}
                  aria-hidden="true"
                />
                <span className="msg-loading-dots" aria-label="Generating">
                  <span /><span /><span />
                </span>
              </div>
            );
          }
          if (m.role === "user") {
            return (
              <div key={m.id} className="msg-row msg-row-user">
                <div className="msg msg-user" dir="auto">{m.content}</div>
              </div>
            );
          }
          return (
            <AssistantMessage key={m.id} content={m.content} citations={m.citations} />
          );
        })}
        <div ref={endRef} aria-hidden="true" />
      </div>
    </div>
  );
}

function SpaceChatComposer({
  space, files, messages, setMessages, onFilesChanged,
}: {
  space: Space;
  files: SpaceFile[];
  messages: SpaceChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<SpaceChatMessage[]>>;
  onFilesChanged: () => void;
}) {
  // Model picker reads from the same persisted prefs store the dashboard
  // composer uses, so changing the model here is visible everywhere and
  // survives a page reload. Same for setModel.
  const { model } = usePrefs();
  const setModel = prefs.setModel;
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const locale: Locale = "en";

  // "+" button on the composer bar → OS file picker → upload each chosen
  // file directly into this space, then refresh the parent file list so
  // the right rail + the 📎 pill update. Dashboard uses the same pattern.
  function openFilePicker() {
    fileInputRef.current?.click();
  }
  async function onFilesChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";                  // allow re-picking the same file
    if (picked.length === 0) return;
    setUploading(true);
    try {
      // Parallel upload, tolerate per-file failures so one bad PDF doesn't
      // abort the whole batch. Surfaces a transcript row on error so the
      // user knows it didn't take.
      const results = await Promise.allSettled(
        picked.map((f) => spacesApi.upload(space.id, f)),
      );
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        setMessages((cur) => [
          ...cur,
          {
            id: `a-${spaceNewId()}`,
            role: "assistant",
            content: `Couldn't attach ${failed.length} file${failed.length === 1 ? "" : "s"}.`,
          },
        ]);
      }
      onFilesChanged();
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 280) + "px";
  }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!composerRef.current?.contains(e.target as Node)) setModelOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const currentModel = MODELS.find((m) => m.id === model) || MODELS[0];

  async function send() {
    const text = value.trim();
    if (!text || sending) return;
    setSending(true);
    setValue("");

    const userId = `u-${spaceNewId()}`;
    const loadingId = `l-${spaceNewId()}`;
    const assistantId = `a-${spaceNewId()}`;

    setMessages((cur) => [
      ...cur,
      { id: userId, role: "user", content: text },
      { id: loadingId, role: "loading" },
    ]);

    // Best-effort space context — small top-k retrieval from indexed files.
    let spaceContext: unknown[] = [];
    try {
      spaceContext = await spacesApi.context(space.id, text);
    } catch {
      // non-fatal; the model just gets less grounding
    }

    // Build the message history to send (excluding the loading placeholder).
    const historyForServer = [
      ...messages.filter((m) => m.role !== "loading").map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.role === "assistant" ? m.content : (m as { content: string }).content,
      })),
      { role: "user" as const, content: text },
    ];

    try {
      const res = await fetch("/api/backend/api/chat/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          model,
          mode: "bedside",
          locale,
          messages: historyForServer,
          useMcps: [],
          spaceContext,
          spaceName: space.name,
          spaceInstructions: space.instructions || "",
        }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`stream failed (${res.status})`);
      }
      // Swap the loading row for an empty assistant row that we'll fill
      // delta-by-delta as the SSE stream arrives.
      setMessages((cur) =>
        cur.filter((m) => m.id !== loadingId).concat({
          id: assistantId, role: "assistant", content: "",
        }),
      );
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalContent = "";
      let citationsForTurn: Citation[] | undefined;

      while (true) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          let event = "message";
          let data = "";
          for (const line of frame.split("\n")) {
            if (line.startsWith("event: ")) event = line.slice(7).trim();
            else if (line.startsWith("data: ")) data += line.slice(6);
          }
          if (!data) continue;
          let parsed: any = null;
          try { parsed = JSON.parse(data); } catch { /* ignore non-JSON */ }
          if (event === "citations" && Array.isArray(parsed)) {
            citationsForTurn = parsed as Citation[];
            setMessages((cur) => cur.map((m) =>
              m.id === assistantId && m.role === "assistant"
                ? { ...m, citations: citationsForTurn }
                : m,
            ));
          } else if (event === "delta" && typeof parsed?.text === "string") {
            finalContent += parsed.text;
            const next = finalContent;
            setMessages((cur) => cur.map((m) =>
              m.id === assistantId && m.role === "assistant"
                ? { ...m, content: next, citations: citationsForTurn }
                : m,
            ));
          } else if (event === "content" && parsed?.content && finalContent === "") {
            finalContent = parsed.content;
            setMessages((cur) => cur.map((m) =>
              m.id === assistantId && m.role === "assistant"
                ? { ...m, content: parsed.content, citations: citationsForTurn }
                : m,
            ));
          } else if (event === "error" && parsed?.error) {
            setMessages((cur) => cur.map((m) =>
              m.id === assistantId && m.role === "assistant"
                ? { ...m, content: "Error: " + parsed.error }
                : m,
            ));
          }
        }
      }
    } catch (e: any) {
      setMessages((cur) =>
        cur.filter((m) => m.id !== loadingId).concat({
          id: `a-${spaceNewId()}`, role: "assistant",
          content: "Error: " + (e?.message || String(e)),
        }),
      );
    } finally {
      setSending(false);
    }
  }

  function brandMark(brand: string) {
    return brand === "anthropic" ? I.anthropicMark
      : brand === "google" ? I.geminiMark
      : <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--muted-2)" }} />;
  }

  return (
    <div className="composer sd-composer" ref={composerRef}>
      {/* Hidden file picker driven by the "+" button below. */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={onFilesChosen}
        accept=".pdf,.csv,.txt,.md,.json,.dcm,application/pdf,text/csv,text/plain,application/json"
      />
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="How can I help you today?"
        rows={1}
        onKeyDown={(e) => {
          // Match dashboard composer: plain Enter sends, Shift+Enter newline,
          // IME composition guard so accent-stacks don't submit prematurely.
          if (e.key === "Enter" && !e.shiftKey && !(e.nativeEvent as any).isComposing) {
            e.preventDefault();
            if (!sending) send();
          }
        }}
      />
      <div className="composer-bar">
        <button
          className="add-btn"
          type="button"
          onClick={openFilePicker}
          disabled={uploading}
          aria-label={uploading ? "Uploading" : "Add file"}
          title={uploading ? "Uploading…" : `Add file to this space (${files.length} attached)`}
          style={{ cursor: uploading ? "progress" : "pointer", opacity: uploading ? 0.6 : 1 }}
        >
          {I.plus}
        </button>
        {files.length > 0 && (
          <span className="model-pill" title="Files in this space are pinned as context">
            📎 {files.length}
          </span>
        )}
        <span className="spacer" />
        <div style={{ position: "relative" }}>
          <button
            className="model-pill"
            type="button"
            data-open={modelOpen}
            onClick={() => setModelOpen((v) => !v)}
          >
            <span className="brand-mark">{brandMark(currentModel.brand)}</span>
            <span>{currentModel.short}</span>
            {I.chev}
          </button>
          {modelOpen && (
            <div className="model-pop" role="menu">
              <div className="pop-header">Reasoning engine</div>
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  className="model-row"
                  type="button"
                  data-active={model === m.id}
                  onClick={() => { setModel(m.id); setModelOpen(false); }}
                >
                  <span className="brand-mark">{brandMark(m.brand)}</span>
                  <span className="col">
                    <span className="nm">{m.name}</span>
                    <span className="meta-row">
                      {m.pills[locale].map((p, i) => <span key={i} className="pill">{p}</span>)}
                    </span>
                  </span>
                  <span className="check">{I.check}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          className="cmpr-icon"
          type="button"
          onClick={send}
          aria-label={sending ? "Sending" : "Send"}
          disabled={sending || value.trim() === ""}
          style={{
            width: "auto",
            padding: "0 10px",
            color: sending || value.trim() === "" ? "var(--muted)" : "var(--cyan)",
            borderColor: sending || value.trim() === "" ? "var(--border)" : "var(--cyan-line)",
            background: sending || value.trim() === "" ? "var(--panel)" : "var(--cyan-soft)",
            opacity: sending || value.trim() === "" ? 0.6 : 1,
            cursor: sending ? "progress" : value.trim() === "" ? "not-allowed" : "pointer",
            transition: "color .12s, background .12s, opacity .12s",
          }}
        >
          {sending ? "…" : "↵"}
        </button>
      </div>
    </div>
  );
}

// ─── Right-rail: Instructions ───────────────────────────────────────────────
// The "+" button on the card opens a Claude-style modal (textarea + Cancel /
// Save). Clicking the existing instructions text re-opens the same modal so
// the user can edit. The card itself only renders the current value, never
// an inline editor — matches the user-supplied mock.
function InstructionsPanel({ space, onSaved }: { space: Space; onSaved: (sp: Space) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="sd-card">
        <div className="sd-card-head">
          <div className="sd-card-title">Instructions</div>
          <button
            type="button"
            className="sd-card-action"
            onClick={() => setOpen(true)}
            aria-label={space.instructions ? "Edit instructions" : "Add instructions"}
          >+</button>
        </div>
        {space.instructions ? (
          <button
            type="button"
            className="sd-instructions-text sd-instructions-clickable"
            onClick={() => setOpen(true)}
            aria-label="Edit instructions"
          >
            {space.instructions}
          </button>
        ) : (
          <div className="sd-card-empty">Add instructions to tailor Claude's responses</div>
        )}
      </div>

      <InstructionsModal
        open={open}
        space={space}
        onClose={() => setOpen(false)}
        onSaved={(sp) => { onSaved(sp); setOpen(false); }}
      />
    </>
  );
}

// InstructionsModal — Claude "Set <name> instructions" dialog. Pre-fills with
// the current value, sends PATCH on Save.
function InstructionsModal({
  open, space, onClose, onSaved,
}: {
  open: boolean;
  space: Space;
  onClose: () => void;
  onSaved: (sp: Space) => void;
}) {
  const [draft, setDraft] = useState(space.instructions || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Sync draft when the modal opens or the upstream value changes.
  useEffect(() => {
    if (open) {
      setDraft(space.instructions || "");
      setErr(null);
    }
  }, [open, space.instructions]);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const sp = await spacesApi.update(space.id, { instructions: draft });
      onSaved(sp);
    } catch (e: any) {
      setErr(e?.error || String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { if (!saving) onClose(); }}
      title={`Set ${space.name} instructions`}
      width={720}
    >
      <div className="instructions-modal-sub">
        Tailor the agent's behaviour inside this space. The instructions are
        prepended to every chat as a system prompt — they only affect this
        space.
      </div>

      <textarea
        className="field-input instructions-textarea"
        value={draft}
        rows={10}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="e.g. Always cite primary sources. Prefer concise, structured answers."
        autoFocus
      />

      {err && <div className="new-space-error">{err}</div>}

      <div className="new-space-actions" style={{ marginTop: 16 }}>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => { if (!saving) onClose(); }}
          disabled={saving}
        >Cancel</button>
        <button
          type="button"
          className="primary-btn"
          onClick={save}
          disabled={saving}
        >{saving ? "Saving…" : "Save instructions"}</button>
      </div>
    </Modal>
  );
}

// ─── Right-rail: Files ──────────────────────────────────────────────────────
function FilesPanel({
  spaceId, files, onChange, onError,
}: {
  spaceId: string;
  files: SpaceFile[];
  onChange: () => void;
  onError: (msg: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadMany(fl: FileList | File[]) {
    setUploading(true);
    try {
      for (const f of Array.from(fl)) {
        try { await spacesApi.upload(spaceId, f); }
        catch (e: any) { onError(e?.error || String(e)); }
      }
      onChange();
    } finally {
      setUploading(false);
    }
  }

  async function remove(fileId: string) {
    if (!confirm("Delete this file?")) return;
    try { await spacesApi.removeFile(spaceId, fileId); onChange(); }
    catch (e: any) { onError(e?.error || String(e)); }
  }

  return (
    <div className="sd-card">
      <div className="sd-card-head">
        <div className="sd-card-title">Files</div>
        <button
          type="button"
          className="sd-card-action"
          onClick={() => inputRef.current?.click()}
          aria-label="Add files"
        >+</button>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => { if (e.target.files?.length) uploadMany(e.target.files); }}
      />

      {files.length === 0 ? (
        <div
          className="sd-dropzone"
          data-drag={dragging}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragging(false);
            if (e.dataTransfer.files?.length) uploadMany(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
        >
          <span className="sd-dropzone-icon" aria-hidden="true">📄📑📃</span>
          <span className="sd-dropzone-text">
            {uploading ? "Uploading…" : "Add PDFs, documents, or other text to reference in this project."}
          </span>
        </div>
      ) : (
        <div className="sd-files">
          {files.map((f) => (
            <div key={f.id} className="sd-file-row">
              <span className="sd-file-name" title={f.name}>{f.name}</span>
              {f.hasText ? (
                <span className="sd-file-badge">{f.chunkCount} chunk{f.chunkCount === 1 ? "" : "s"}</span>
              ) : (
                <span className="sd-file-badge warn">binary</span>
              )}
              <button
                type="button"
                className="sd-file-del"
                onClick={() => remove(f.id)}
                aria-label="Delete"
              >×</button>
            </div>
          ))}
          <button
            type="button"
            className="sd-files-add-more"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Uploading…" : "+ Add more files"}
          </button>
        </div>
      )}
    </div>
  );
}
