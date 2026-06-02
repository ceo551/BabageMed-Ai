"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { I } from "../../icons";
import { useUI } from "../../lib/ui-context";
import { usePrefs } from "../../lib/store";
import { chats as chatsApi, spaces as spacesApi, type Space, type Chat } from "../../lib/api";
import { AssistantMessage, type Citation } from "../../components/AssistantMessage";
import { TEXT_MODELS, type ModelBrand } from "../../lib/models";

// SpaceChat — the per-space workspace composer + transcript. Adapted from
// FeatureChat: same streaming/transcript/composer plumbing, but the request
// is grounded against the SPACE's retrieved context instead of a feature's
// file list. On every user turn we:
//   1. retrieve top chunks via spaces.context(id, userText)
//   2. send them as `spaceContext` together with `spaceName` and
//      `featureInstructions` (the backend's buildSystem reads all three).
// Spaces are text-only, so the model picker shows the 8 chat LLMs.
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

export function SpaceChat({ space }: { space: Space }) {
  const params = useSearchParams();
  const router = useRouter();
  const { s, locale } = useUI();
  const chatIdParam = params?.get("c") || "";
  const nonceParam  = params?.get("n") || "";

  const [messages, setMessages] = useState<Msg[]>([]);
  const isChatting = messages.length > 0;
  const [chatId, setChatId] = useState<string>("");
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [model, setModel] = useState<string>(() => TEXT_MODELS[0].id);
  // mode comes from the global prefs store so it persists across pages.
  const { mode } = usePrefs();
  const [modelOpen, setModelOpen] = useState(false);
  const [webSearch, setWebSearch] = useState(false);

  const liveLoadRef = useRef<string>("");
  const streamAbortRef = useRef<AbortController | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Load chat messages on URL change.
  useEffect(() => {
    if (chatIdParam) {
      if (chatIdParam === chatId) return;
      streamAbortRef.current?.abort();
      setChatId(chatIdParam);
      const requestedId = chatIdParam;
      liveLoadRef.current = requestedId;
      // Verify the chat belongs to THIS space before loading it — a stale or
      // hand-edited ?c=<id> must not load another space's (or a general/
      // feature) conversation into this space.
      chatsApi.get(requestedId)
        .then((chat) => {
          if (requestedId !== liveLoadRef.current) return null;
          if ((chat.spaceId || "") !== space.id) {
            router.replace(`/spaces/${encodeURIComponent(space.id)}`);
            return null;
          }
          return chatsApi.messages(requestedId);
        })
        .then((rows) => {
          if (!rows || requestedId !== liveLoadRef.current) return;
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
    // Re-bind once the chatting branch mounts .feat-chat-scroll with the
    // transcript (on the home screen it isn't present, so the listener would
    // otherwise never attach).
  }, [isChatting]);
  useLayoutEffect(() => {
    if (!stickRef.current) return;
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // Close model popover on outside click / Escape.
  useEffect(() => {
    if (!modelOpen) return;
    function onDoc(e: MouseEvent) {
      if (!composerRef.current?.contains(e.target as Node)) {
        setModelOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setModelOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [modelOpen]);

  const currentModel = TEXT_MODELS.find((m) => m.id === model) || TEXT_MODELS[0];

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
      // Lazily create the persisted chat row on first turn, tagged with THIS
      // space so it shows up in the space's own threads list and is kept out
      // of the general sidebar history.
      let activeChatId = chatId;
      if (!activeChatId) {
        try {
          const created = await chatsApi.create(text, model, mode || "bedside", undefined, space.id);
          activeChatId = created.id;
          setChatId(created.id);
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.set("c", created.id);
            url.searchParams.delete("n");
            window.history.replaceState({}, "", url.toString());
            window.dispatchEvent(new CustomEvent("pervagans:chat-created", { detail: { id: created.id } }));
          }
        } catch { /* persistence is best-effort */ }
      }
      if (activeChatId) {
        chatsApi.append(activeChatId, { role: "user", content: text }).catch(() => {});
      }

      // Retrieve the space's most relevant chunks for this question and pass
      // them to the backend's prompt builder (spaceContext / spaceName /
      // featureInstructions). Failures fall back to an empty context.
      const chunks = await spacesApi.context(space.id, text).catch(() => []);

      const body = JSON.stringify({
        model,
        mode: mode || "bedside",
        locale,
        featureInstructions: space.instructions || "",
        spaceName: space.name,
        spaceSkills: space.skills || [],
        spaceContext: chunks,
        messages: [
          ...messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ role: m.role, content: "content" in m ? m.content : "" })),
          { role: "user", content: text },
        ],
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
        buffer += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, "\n");

        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          let event = "message";
          let data = "";
          for (const line of frame.split("\n")) {
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
            finalContent = "Error: " + parsed.error;
          }
        }
      }

      if (finalContent === "") {
        // Stream ended with no content (e.g. no model API key configured for
        // this space) — show a clear message instead of a blank bubble.
        finalContent = locale === "ar"
          ? "لا توجد استجابة — تأكد من إعداد مفتاح الموديل لهذه المساحة."
          : "No response — check this space's model configuration.";
        const fc = finalContent;
        setMessages((cur) =>
          cur.map((m) => (m.id === assistantId && m.role === "assistant" ? { ...m, content: fc } : m)),
        );
      }
      if (activeChatId && finalContent !== "") {
        chatsApi.append(activeChatId, { role: "assistant", content: finalContent, citations: cites ?? [] }).catch(() => {});
      }
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      if (err?.name === "AbortError") {
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

  function openThread(id: string) {
    router.push(`/spaces/${encodeURIComponent(space.id)}?c=${encodeURIComponent(id)}`);
  }

  const composerInner = (
    <div className="composer">
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={s.spaceChatPlaceholder}
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
          className="model-pill ws-chip"
          aria-pressed={webSearch}
          onClick={() => setWebSearch((v) => !v)}
          title={s.webSearch}
          style={webSearch ? {
            background: "var(--cyan-soft)", color: "var(--cyan)",
            border: "1px solid var(--cyan-line)", display: "inline-flex", alignItems: "center",
          } : { display: "inline-flex", alignItems: "center" }}
        >
          {I.globe}{s.webSearch}{webSearch ? " ×" : ""}
        </button>
        <span className="spacer" />
        {/* Model picker — spaces are text-only, so the 8 chat LLMs. */}
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
              <div className="pop-header">{s.modelHeader}</div>
              {TEXT_MODELS.map((m) => (
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
  );

  return (
    <div className="feat-chat" data-chat={isChatting}>
      {isChatting ? (
        <>
          <div className="feat-chat-scroll">
            <Transcript messages={messages} endRef={transcriptEndRef} />
          </div>
          <div className="feat-composer" ref={composerRef}>{composerInner}</div>
        </>
      ) : (
        <div className="feat-chat-scroll">
          {/* Space home: hero, a centered composer, then this space's threads. */}
          <div className="space-home">
            <div className="feat-chat-empty">
              <span className="feat-chat-empty-emoji" aria-hidden="true">{space.icon || "📁"}</span>
              <h2>{space.name}</h2>
              <p>{space.description || s.featureChatEmpty}</p>
            </div>
            <div className="space-home-composer" ref={composerRef}>{composerInner}</div>
            <SpaceThreads spaceId={space.id} onOpen={openThread} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Threads list (this space's recorded chats, shown under the composer) ────
function SpaceThreads({ spaceId, onOpen }: { spaceId: string; onOpen: (id: string) => void }) {
  const { s } = useUI();
  const [items, setItems] = useState<Chat[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      chatsApi.list(undefined, spaceId)
        .then((rows) => { if (!cancelled) setItems(rows); })
        .catch(() => { if (!cancelled) setItems([]); });
    load();
    const onCreated = () => load();
    if (typeof window !== "undefined") window.addEventListener("pervagans:chat-created", onCreated);
    return () => {
      cancelled = true;
      if (typeof window !== "undefined") window.removeEventListener("pervagans:chat-created", onCreated);
    };
  }, [spaceId]);

  if (items.length === 0) return null;
  return (
    <div className="space-threads">
      <div className="space-threads-label">{s.recent}</div>
      <ul className="space-threads-list">
        {items.map((c) => (
          <li key={c.id}>
            <button type="button" className="space-thread-row" onClick={() => onOpen(c.id)} title={c.title || s.untitledChat}>
              <span className="space-thread-icon" aria-hidden="true">{I.chatBubble}</span>
              <span className="space-thread-title">{c.title || s.untitledChat}</span>
            </button>
          </li>
        ))}
      </ul>
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
  const { s } = useUI();
  return (
    <div className="transcript feat-transcript">
      {messages.map((m) => {
        if (m.role === "loading") {
          return (
            <div key={m.id} className="msg msg-assistant msg-loading">
              <img src="/pervagans-icon.png" alt="" className="msg-loading-mark" width={40} height={40} aria-hidden="true" />
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
