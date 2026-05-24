"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
          <SpaceComposer space={space} files={files} />
          <div className="sd-chat-hint">
            Start a chat to keep conversations organized and re-use {space.name} knowledge.
          </div>
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

// ─── Composer ───────────────────────────────────────────────────────────────
// Slimmed-down version of the dashboard composer that pins this space.
function SpaceComposer({ space, files }: { space: Space; files: SpaceFile[] }) {
  const [value, setValue] = useState("");
  // useState narrows MODELS[0].id to the literal "opus-4.7" otherwise — widen
  // back to the union so setModel(m.id) for any model is type-safe.
  const [model, setModel] = useState<string>(MODELS[0].id);
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState<string>("");
  const [voiceOn, setVoiceOn] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const locale: Locale = "en";

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
    if (!value.trim() || sending) return;
    setSending(true);
    setReply("");
    try {
      let spaceContext: unknown[] = [];
      try {
        spaceContext = await spacesApi.context(space.id, value);
      } catch {/* non-fatal */}
      const r = await fetch("/api/backend/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          model,
          mode: "bedside",
          locale,
          messages: [{ role: "user", content: value }],
          useMcps: [],
          spaceContext,
          spaceName: space.name,
          spaceInstructions: space.instructions || "",
        }),
      });
      const j = await r.json();
      setReply(j?.completion?.content || j?.error || "(no response)");
    } catch (e: any) {
      setReply("Error: " + e.message);
    } finally {
      setSending(false);
    }
  }

  function brandMark(brand: string) {
    return brand === "anthropic" ? I.anthropicMark : brand === "google" ? I.geminiMark : <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--muted-2)" }} />;
  }

  return (
    <>
      <div className="composer sd-composer" ref={composerRef}>
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="How can I help you today?"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="composer-bar">
          <button
            className="add-btn"
            type="button"
            aria-label="Add to chat"
            title={`${files.length} file${files.length === 1 ? "" : "s"} in this space`}
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
              <span style={{ opacity: 0.6, fontSize: 11 }}>Adaptive</span>
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
            data-on={voiceOn}
            onClick={() => setVoiceOn((v) => !v)}
            aria-label="Mic"
          >{I.mic}</button>
          <button className="cmpr-icon" type="button" aria-label="Voice">{I.voice}</button>
          <button
            className="cmpr-icon"
            type="button"
            onClick={send}
            aria-label="Send"
            disabled={sending}
            style={{ width: "auto", padding: "0 10px", color: "var(--cyan)", borderColor: "var(--cyan-line)", background: "var(--cyan-soft)" }}
          >
            {sending ? "…" : "↵"}
          </button>
        </div>
      </div>
      {reply && (
        <div className="sd-reply">{reply}</div>
      )}
    </>
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
