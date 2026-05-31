"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { I, featureIcon } from "../../icons";
import { useUI } from "../../lib/ui-context";
import { usePrefs } from "../../lib/store";
import { chats as chatsApi, features as featuresApi, type Feature as FeatureRow } from "../../lib/api";
import { AssistantMessage, type Citation } from "../../components/AssistantMessage";
import type { FeatureMeta } from "../../i18n";
import {
  modelsForFeature,
  defaultModelId,
  type ModelBrand,
} from "../../lib/models";

// FeatureChat — the per-feature workspace's composer + transcript.
// Mirrors the dashboard's chat lifecycle (URL ?c=<id> loads a chat, sends
// stream via /api/backend/api/chat/stream) but is scoped to a single
// feature so:
//   - the chat row is created with feature_slug = meta.slug, which keeps
//     it off the general History sidebar
//   - the request body includes the feature's instructions, file text
//     bodies (as spaceContext) and connector ids (as useMcps) so the
//     assistant grounds answers against this workflow's tuning
//   - the model picker reflects the feature's modality (text features
//     get the 8 chat LLMs; visual features get the image + video groups)
type Msg =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "assistant"; content: string; citations?: Citation[] }
  | { id: string; role: "loading" };

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function FeatureChat({
  meta,
  feature,
  onFeatureUpdate,
}: {
  meta: FeatureMeta;
  // Backend feature row — instructions / connector ids / file metadata
  // used to ground the LLM. Null until the first fetch lands.
  feature: FeatureRow | null;
  // Sync handler — called whenever the composer (+) menu uploads a file
  // or adds a skill, so the sub-sidebar panels see the change immediately.
  onFeatureUpdate?: (f: FeatureRow) => void;
}) {
  const params = useSearchParams();
  const { s, locale } = useUI();
  const chatIdParam = params?.get("c") || "";
  const nonceParam  = params?.get("n") || "";

  const [messages, setMessages] = useState<Msg[]>([]);
  const [chatId, setChatId] = useState<string>("");
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [model, setModel] = useState<string>(() => defaultModelId(meta));
  // mode comes from the global prefs store so it persists across pages.
  const { mode } = usePrefs();
  const [modelOpen, setModelOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Composer (+) popover — Add file / Add skill / Web search / Add connector.
  const [addOpen, setAddOpen] = useState(false);
  const [webSearch, setWebSearch] = useState(false);

  const liveLoadRef = useRef<string>("");
  const streamAbortRef = useRef<AbortController | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const skillInputRef = useRef<HTMLInputElement>(null);

  // Reset model when feature changes (e.g. visual ↔ text would otherwise
  // keep a stale id that doesn't exist in the new picker).
  useEffect(() => {
    setModel(defaultModelId(meta));
  }, [meta.slug, meta.modality]);

  // Load chat messages on URL change.
  useEffect(() => {
    if (chatIdParam) {
      if (chatIdParam === chatId) return;
      // Abort any in-flight stream from the chat we're switching AWAY from,
      // so its remaining tokens don't write into the newly-loaded chat's
      // transcript (the dashboard does this; FeatureChat previously only
      // aborted on unmount).
      streamAbortRef.current?.abort();
      setChatId(chatIdParam);
      const requestedId = chatIdParam;
      liveLoadRef.current = requestedId;
      chatsApi.messages(requestedId)
        .then((rows) => {
          if (requestedId !== liveLoadRef.current) return;
          setMessages(rows.map((r) => {
            if (r.role === "user") return { id: r.id, role: "user", content: r.content } as Msg;
            const cs = Array.isArray(r.citations) ? (r.citations as Citation[]) : undefined;
            return { id: r.id, role: "assistant", content: r.content, citations: cs } as Msg;
          }));
        })
        .catch(() => { /* leave transcript empty on 401/404 */ });
    } else {
      setChatId("");
      setMessages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatIdParam, nonceParam]);

  // Abort any in-flight stream when the chat changes or the page unmounts.
  useEffect(() => () => { streamAbortRef.current?.abort(); }, []);

  // Auto-grow textarea.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 280) + "px";
  }, [value]);

  // Auto-scroll transcript to bottom on new tokens, with a "user has
  // scrolled up" suppression so reading earlier output doesn't yank.
  const stickRef = useRef(true);
  useEffect(() => {
    const scroller = transcriptEndRef.current?.closest(".feat-chat-scroll") as HTMLElement | null;
    if (!scroller) return;
    function onScroll() {
      if (!scroller) return;
      const dist = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      stickRef.current = dist < 120;
    }
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);
  useLayoutEffect(() => {
    if (!stickRef.current) return;
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // Close model OR add popover on outside click / Escape — keyboard parity
  // with the click-outside behaviour so a user who tab-opened the picker
  // can also tab-close it without reaching for the mouse.
  useEffect(() => {
    if (!modelOpen && !addOpen) return;
    function onDoc(e: MouseEvent) {
      if (!composerRef.current?.contains(e.target as Node)) {
        setModelOpen(false);
        setAddOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setModelOpen(false); setAddOpen(false); }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [modelOpen, addOpen]);

  const group = modelsForFeature(meta);
  const allModels = group.kind === "text"
    ? group.models
    : [...group.image, ...group.video];
  const currentModel = allModels.find((m) => m.id === model) || allModels[0];

  async function send() {
    const text = value.trim();
    if (!text || sending) return;

    const userMsgId = `u-${newId()}`;
    const loadingId = `l-${newId()}`;
    setMessages((cur) => [
      ...cur,
      { id: userMsgId, role: "user", content: text },
      { id: loadingId, role: "loading" },
    ]);
    setValue("");
    setSending(true);

    try {
      // Lazily create the persisted chat row on first turn. Tag it with
      // this feature's slug so the chat shows up in the feature's
      // sub-sidebar history and is filtered out of the general History.
      let activeChatId = chatId;
      if (!activeChatId) {
        try {
          const created = await chatsApi.create(text, model, mode || "bedside", meta.slug);
          activeChatId = created.id;
          setChatId(created.id);
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.set("c", created.id);
            url.searchParams.delete("n");
            window.history.replaceState({}, "", url.toString());
            // Same custom event as the home page so the sub-sidebar
            // history list surfaces the new chat without waiting for
            // the next route push.
            window.dispatchEvent(new CustomEvent("babbage:chat-created", { detail: { id: created.id } }));
          }
        } catch { /* persistence is best-effort */ }
      }
      if (activeChatId) {
        chatsApi.append(activeChatId, { role: "user", content: text }).catch(() => {});
      }

      // Ground the assistant against this feature's instructions / files
      // / connectors. spaceName/spaceContext are reused so the backend's
      // existing prompt builder doesn't need a new code path.
      const ctxChunks = (feature?.files || []).slice(0, 6).map((f) => ({
        title: f.name,
        // Files come back from the backend as metadata only; full text
        // bodies live behind `/api/features/<slug>/files/<id>/text` (when
        // wired). For the MVP we pass file names as hints; the assistant
        // can ask the user to attach specifics. Real text injection is a
        // follow-up that needs a small backend addition.
        text: `(File available in this feature: ${f.name})`,
      }));

      const body = JSON.stringify({
        model,
        mode: mode || "bedside",
        locale,
        feature: meta.slug,
        featureInstructions: feature?.instructions || "",
        messages: [
          ...messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ role: m.role, content: "content" in m ? m.content : "" })),
          { role: "user", content: text },
        ],
        useMcps: feature?.connectors || [],
        spaceContext: ctxChunks,
        spaceName: meta.label,
        enableWebSearch: webSearch,
      });

      const controller = new AbortController();
      streamAbortRef.current?.abort();
      streamAbortRef.current = controller;
      const r = await fetch("/api/backend/api/chat/stream", {
        method: "POST",
        headers: { "content-type": "application/json", "accept": "text/event-stream" },
        credentials: "include",
        body,
        signal: controller.signal,
      });
      if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);

      const assistantId = `a-${newId()}`;
      setMessages((cur) =>
        cur.filter((m) => m.id !== loadingId).concat({ id: assistantId, role: "assistant", content: "" })
      );

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let cites: Citation[] | undefined;
      let finalContent = "";

      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        // Normalise CRLF → LF (see page.tsx for the rationale — some
        // proxies emit \r\n between SSE frames and \r in data breaks
        // JSON.parse downstream).
        buffer += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, "\n");

        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          let event = "message";
          let data = "";
          for (const line of frame.split("\n")) {
            // Accept `data: foo` AND `data:foo` per SSE spec.
            if (line.startsWith("event:")) {
              event = line.slice(line[6] === " " ? 7 : 6).trim();
            } else if (line.startsWith("data:")) {
              data += (data ? "\n" : "") + line.slice(line[5] === " " ? 6 : 5);
            }
          }
          if (!data) continue;

          let parsed: any = null;
          try { parsed = JSON.parse(data); } catch { /* ignore */ }

          if (event === "citations" && Array.isArray(parsed)) {
            cites = parsed as Citation[];
            setMessages((cur) =>
              cur.map((m) => m.id === assistantId && m.role === "assistant" ? { ...m, citations: cites } : m),
            );
          } else if (event === "delta" && typeof parsed?.text === "string") {
            finalContent += parsed.text;
            const next = finalContent;
            setMessages((cur) =>
              cur.map((m) => m.id === assistantId && m.role === "assistant" ? { ...m, content: next, citations: cites } : m),
            );
          } else if (event === "content" && parsed?.content) {
            if (finalContent === "") {
              finalContent = parsed.content;
              setMessages((cur) =>
                cur.map((m) => m.id === assistantId && m.role === "assistant" ? { ...m, content: parsed.content, citations: cites } : m),
              );
            }
          } else if (event === "error" && parsed?.error) {
            setMessages((cur) =>
              cur.map((m) => m.id === assistantId && m.role === "assistant" ? { ...m, content: "Error: " + parsed.error } : m),
            );
            // Same fix as page.tsx round 27: persist the error row so
            // a chat reload doesn't silently drop it (the user saw
            // "Error: …" on screen; dropping it on persist leaves a
            // confusing gap on refresh).
            finalContent = "Error: " + parsed.error;
          }
        }
      }

      if (activeChatId && finalContent !== "") {
        chatsApi.append(activeChatId, { role: "assistant", content: finalContent, citations: cites ?? [] }).catch(() => {});
      }
      // Sub-sidebar history refresh is now driven by the
      // `babbage:chat-created` window event the create branch above
      // dispatches (round 27) — pathname doesn't change on
      // replaceState so the previous pathname-keyed effect couldn't
      // see the new chat until the next real route push.
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      if (err?.name === "AbortError") {
        // Intentional abort (chat switch / unmount) — just drop the
        // loading row, don't render a confusing "Error: aborted" bubble.
        setMessages((cur) => cur.filter((m) => m.id !== loadingId));
      } else {
        setMessages((cur) =>
          cur.filter((m) => m.id !== loadingId)
            .concat({ id: `a-${newId()}`, role: "assistant", content: "Error: " + (err?.message || String(e)) })
        );
      }
    } finally {
      setSending(false);
      streamAbortRef.current = null;
    }
  }

  const isChatting = messages.length > 0;

  return (
    <div className="feat-chat" data-chat={isChatting}>
      <div className="feat-chat-scroll">
        {isChatting ? (
          <Transcript messages={messages} endRef={transcriptEndRef} />
        ) : (
          <div className="feat-chat-empty">
            <span className="feat-chat-empty-emoji" aria-hidden="true">{featureIcon(meta.slug, meta.emoji)}</span>
            <h2>{meta.label}</h2>
            <p>{s.featureChatEmpty}</p>
          </div>
        )}
      </div>

      <div className="feat-composer" ref={composerRef}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          accept=".pdf,.csv,.txt,.md,.json,.dcm,.docx,application/pdf,text/csv,text/plain,application/json"
          onChange={async (e) => {
            const fl = e.target.files;
            if (!fl || fl.length === 0) return;
            setUploading(true);
            try {
              const upd = await featuresApi.upload(meta.slug, fl);
              onFeatureUpdate?.(upd);
            }
            catch { /* tolerated — user can retry from the rail */ }
            finally {
              setUploading(false);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }
          }}
        />
        <input
          ref={skillInputRef}
          type="file"
          multiple
          hidden
          accept=".md,.txt,.json,.yaml,.yml,.prompt"
          onChange={async (e) => {
            const fl = e.target.files;
            if (!fl || fl.length === 0) return;
            setUploading(true);
            try {
              const names = Array.from(fl).map((f) => f.name);
              const cur = feature?.skills || [];
              const merged = Array.from(new Set([...cur, ...names]));
              const upd = await featuresApi.update(meta.slug, { skills: merged });
              onFeatureUpdate?.(upd);
            }
            catch { /* tolerated */ }
            finally {
              setUploading(false);
              if (skillInputRef.current) skillInputRef.current.value = "";
            }
          }}
        />
        <div className="composer">
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={s.placeholder}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !(e.nativeEvent as any).isComposing) {
                e.preventDefault();
                if (!sending) send();
              }
            }}
          />
          <div className="composer-bar">
            <button
              type="button"
              className="add-btn"
              data-open={addOpen}
              aria-label={s.addConnector}
              title={s.addConnector}
              disabled={uploading}
              onClick={(e) => { e.preventDefault(); setAddOpen((v) => !v); setModelOpen(false); }}
            >
              {I.plus}
            </button>
            {addOpen && (
              <div className="popover" role="menu">
                <button
                  type="button"
                  className="popover-row"
                  onClick={() => { setAddOpen(false); fileInputRef.current?.click(); }}
                  disabled={uploading}
                  style={{ width: "100%", textAlign: "start", border: 0, background: "transparent", cursor: uploading ? "progress" : "pointer" }}
                >
                  {I.folder}
                  <span className="col">
                    <span className="ttl">{uploading ? s.saving : s.addFile}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="popover-row"
                  onClick={() => { setAddOpen(false); skillInputRef.current?.click(); }}
                  disabled={uploading}
                  style={{ width: "100%", textAlign: "start", border: 0, background: "transparent", cursor: uploading ? "progress" : "pointer" }}
                >
                  {I.skills}
                  <span className="col">
                    <span className="ttl">{s.addSkill}</span>
                  </span>
                </button>
                {/* Web search + connectors aren't useful on the visual
                    (Image & Video / Advertisements) features — their
                    generations don't ground on text sources — so hide them. */}
                {meta.modality !== "visual" && (
                  <button
                    type="button"
                    className="popover-row"
                    aria-pressed={webSearch}
                    onClick={() => { setWebSearch((v) => !v); setAddOpen(false); }}
                    style={{ width: "100%", textAlign: "start", border: 0, background: "transparent", cursor: "pointer" }}
                  >
                    {I.globe}
                    <span className="col">
                      <span className="ttl">{s.webSearch}</span>
                      <span className="desc">{s.webSearchDesc}</span>
                    </span>
                    {webSearch && <span className="check" style={{ opacity: 1 }}>{I.check}</span>}
                  </button>
                )}
                {meta.modality !== "visual" && (
                  <Link
                    href="/mcps"
                    className="popover-row"
                    style={{ textDecoration: "none" }}
                    onClick={() => setAddOpen(false)}
                  >
                    {I.link}
                    <span className="col">
                      <span className="ttl">{s.addConnector}</span>
                      <span className="desc">{s.addConnectorDesc}</span>
                    </span>
                  </Link>
                )}
              </div>
            )}
            {webSearch && (
              <button
                type="button"
                className="model-pill"
                onClick={() => setWebSearch(false)}
                title={s.webSearch}
                style={{ background: "var(--cyan-soft)", color: "var(--cyan)", border: "1px solid var(--cyan-line)", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {I.globe}{s.webSearch} ×
              </button>
            )}
            <span className="spacer" />
          {/* Model picker — text features show one list of 8 chat LLMs;
              visual features (image & video, advertisements) show two
              grouped lists (Image · Video). */}
          <div className="feat-model-wrap">
            <button
              type="button"
              className="model-pill"
              data-open={modelOpen}
              onClick={() => setModelOpen((v) => !v)}
            >
              <span className="brand-mark">{brandMark(currentModel.brand)}</span>
              <span>{currentModel.short}</span>
              {I.chev}
            </button>
            {modelOpen && (
              <div className="model-pop feat-model-pop" role="menu">
                {group.kind === "text" ? (
                  <>
                    <div className="pop-header">{s.modelHeader}</div>
                    {group.models.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className="model-row"
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
                  </>
                ) : (
                  <>
                    <div className="pop-header">{s.imageGroup}</div>
                    {group.image.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className="model-row"
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
                    <div className="popover-sep" />
                    <div className="pop-header">{s.videoGroup}</div>
                    {group.video.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className="model-row"
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
                  </>
                )}
              </div>
            )}
          </div>

            <button className="cmpr-icon" type="button" aria-label={s.voiceComingSoon} title={s.voiceComingSoon}>{I.mic}</button>
            <button
              type="button"
              className="cmpr-icon"
              onClick={send}
              aria-label={sending ? "Sending" : "Send"}
              disabled={sending || value.trim() === ""}
              style={{
                width: "auto",
                padding: "0 10px",
                color: sending || value.trim() === "" ? "var(--muted)" : "var(--hue-ink, var(--cyan))",
                borderColor: sending || value.trim() === "" ? "var(--border)" : "var(--hue-line, var(--cyan-line))",
                background: sending || value.trim() === "" ? "var(--panel)" : "var(--hue-bg, var(--cyan-soft))",
                opacity: sending || value.trim() === "" ? 0.6 : 1,
                cursor: sending ? "progress" : value.trim() === "" ? "not-allowed" : "pointer",
                transition: "color .12s, background .12s, opacity .12s",
              }}
            >
              {sending ? "…" : "↵"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function brandMark(brand: ModelBrand): React.ReactNode {
  switch (brand) {
    case "anthropic":  return I.anthropicMark;
    case "google":     return I.geminiMark;
    case "openai":     return I.openaiMark;
    case "xai":        return I.xaiMark;
    case "deepseek":   return I.deepseekMark;
    case "alibaba":    return I.alibabaMark;
    case "moonshot":   return I.moonshotMark;
    case "zhipu":      return I.zhipuMark;
    case "kling":      return I.klingMark;
    case "bytedance":  return I.bytedanceMark;
    case "happyhorse": return I.happyhorseMark;
    default:           return <span className="brand-fallback" />;
  }
}

function Transcript({ messages, endRef }: { messages: Msg[]; endRef: React.RefObject<HTMLDivElement> }) {
  // Round 24: `s` lives on FeatureChat's scope, not Transcript's. The
  // previous code crashed any feature page the moment a "loading" row
  // rendered (ReferenceError: s is not defined). Read useUI here so
  // Transcript is self-contained.
  const { s } = useUI();
  return (
    <div className="transcript feat-transcript">
      {messages.map((m) => {
        if (m.role === "loading") {
          return (
            <div key={m.id} className="msg msg-assistant msg-loading">
              <img src="/babbage-icon.png" alt="" className="msg-loading-mark" width={40} height={40} aria-hidden="true" />
              <span className="msg-loading-dots" aria-label={s.generating}><span /><span /><span /></span>
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
        return <AssistantMessage key={m.id} content={m.content} citations={m.citations} />;
      })}
      <div ref={endRef} aria-hidden="true" />
    </div>
  );
}
