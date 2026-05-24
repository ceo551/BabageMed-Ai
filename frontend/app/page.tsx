"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MODELS, type Locale, type LocaleStrings } from "./i18n";
import { I } from "./icons";
import { useUI } from "./lib/ui-context";
import { ConnectorIcon } from "./components/ConnectorIcon";
import { AssistantMessage, type Citation } from "./components/AssistantMessage";
import {
  spaces as spacesApi,
  connectors as connectorsApi,
  chats as chatsApi,
  type Space,
  type Connector,
} from "./lib/api";

// Dashboard — Claude/Gemini-style two-phase shell:
//   • Empty state: centered greeting + composer (original look).
//   • Chat state: transcript of user/assistant turns, composer pinned bottom.
// Messages lifted here so the composer's send() can append turns and the
// transcript stays mounted across re-renders. Conversation is per-tab today
// (refresh = new chat); persistence is a follow-up when chats table ships.
type ChatMessage =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "assistant"; content: string; citations?: Citation[] }
  | { id: string; role: "loading" };

// Next.js 14's App Router requires components that call useSearchParams() to
// either live inside a <Suspense> boundary OR have the route opted out of
// prerendering. We use Suspense here so we keep client-side navigation fast
// (no full server roundtrip on every URL update) while satisfying the
// static-export check.
export default function Dashboard() {
  return (
    <Suspense fallback={<div className="stage" />}>
      <DashboardInner />
    </Suspense>
  );
}

function DashboardInner() {
  const { locale, s } = useUI();
  const params = useSearchParams();
  const chatIdParam = params?.get("c") || "";
  // 'n' is the cache-buster the sidebar's New button puts on the URL to
  // force a fresh chat even when we're already on /. Reading it here just
  // means the effect re-runs and clears state — value itself is ignored.
  const nonceParam = params?.get("n") || "";

  const [model, setModel] = useState<string>("opus-4.7");
  const [mode, setMode] = useState<string>("bedside");
  const [activeSpaceId, setActiveSpaceId] = useState<string>("");
  const [activeConnectorIds, setActiveConnectorIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Currently active persisted chat. Null when we haven't created one yet
  // (fresh session) — first send() will POST /api/chats and set it.
  const [chatId, setChatId] = useState<string>("");

  // Sync chat state with the URL: ?c=<id> loads that chat, no ?c means
  // brand-new chat. The nonce param also forces a reset when clicking
  // "New" while already on /.
  useEffect(() => {
    if (chatIdParam) {
      // Load existing chat. Skip if it's already the active one.
      if (chatIdParam === chatId) return;
      setChatId(chatIdParam);
      chatsApi.messages(chatIdParam)
        .then((rows) => {
          setMessages(rows.map((r) => {
            if (r.role === "user") {
              return { id: r.id, role: "user", content: r.content } as ChatMessage;
            }
            // citations on the row are arbitrary JSON; cast to Citation[] when shaped.
            const cs = Array.isArray(r.citations) ? (r.citations as Citation[]) : undefined;
            return { id: r.id, role: "assistant", content: r.content, citations: cs } as ChatMessage;
          }));
        })
        .catch(() => { /* if it 404s / 401s, leave the transcript empty */ });
    } else {
      // No chatId in URL → fresh chat. Reset everything.
      setChatId("");
      setMessages([]);
      setActiveSpaceId("");
      setActiveConnectorIds([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatIdParam, nonceParam]);

  const isChatting = messages.length > 0;

  return (
    <section className="stage" data-chat={isChatting} data-screen-label="01 Dashboard home">
      <div className="stage-inner" data-chat={isChatting}>
        {isChatting ? (
          <Transcript messages={messages} />
        ) : (
          <h1 className="greet">
            {I.star}
            <span className="brand-greet">
              <span className="b1">Babage</span>
              <span className="b2">Med</span>
              <em className="b3"> Ai</em>
            </span>
          </h1>
        )}
        <Composer
          s={s}
          locale={locale}
          model={model}
          setModel={setModel}
          mode={mode}
          setMode={setMode}
          activeSpaceId={activeSpaceId}
          setActiveSpaceId={setActiveSpaceId}
          activeConnectorIds={activeConnectorIds}
          setActiveConnectorIds={setActiveConnectorIds}
          messages={messages}
          setMessages={setMessages}
          chatId={chatId}
          setChatId={setChatId}
        />
      </div>
    </section>
  );
}

// ─── Transcript ──────────────────────────────────────────────────────────────
// User turns render as right-aligned chips; assistant turns flow as plain
// prose (no chip) so multi-paragraph answers read naturally. The "loading"
// placeholder swaps in the pulsing brand mark while we're waiting on the LLM.
function Transcript({ messages }: { messages: ChatMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  // Use useLayoutEffect so the scroll happens before the browser paints —
  // avoids a flash of "stuck at top" when a long message lands.
  useLayoutEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="transcript">
      {messages.map((m) => {
        if (m.role === "loading") {
          return (
            <div key={m.id} className="msg msg-assistant msg-loading">
              <img
                src="/babagemed-icon.png"
                alt=""
                className="msg-loading-mark"
                width={28}
                height={28}
                aria-hidden="true"
              />
            </div>
          );
        }
        if (m.role === "user") {
          return (
            <div key={m.id} className="msg-row msg-row-user">
              <div className="msg msg-user">{m.content}</div>
            </div>
          );
        }
        return (
          <AssistantMessage
            key={m.id}
            content={m.content}
            citations={m.citations}
          />
        );
      })}
      <div ref={endRef} aria-hidden="true" />
    </div>
  );
}

// ─── Composer ────────────────────────────────────────────────────────────────
function Composer({
  s, locale, model, setModel,
  activeSpaceId, setActiveSpaceId,
  activeConnectorIds, setActiveConnectorIds,
  messages, setMessages,
  chatId, setChatId,
}: {
  s: LocaleStrings;
  locale: Locale;
  model: string;
  setModel: (m: string) => void;
  mode: string;
  setMode: (m: string) => void;
  activeSpaceId: string;
  setActiveSpaceId: (id: string) => void;
  activeConnectorIds: string[];
  setActiveConnectorIds: React.Dispatch<React.SetStateAction<string[]>>;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  chatId: string;
  setChatId: (id: string) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [value, setValue] = useState("");
  const [voiceOn, setVoiceOn] = useState(false);
  const [sending, setSending] = useState(false);
  const [userSpaces, setUserSpaces] = useState<Space[]>([]);
  const [userConnectors, setUserConnectors] = useState<Connector[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    spacesApi.list().then(setUserSpaces).catch(() => setUserSpaces([]));
    connectorsApi.list().then(setUserConnectors).catch(() => setUserConnectors([]));
  }, []);

  const activeSpace = useMemo(
    () => userSpaces.find((sp) => sp.id === activeSpaceId),
    [userSpaces, activeSpaceId]
  );

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!composerRef.current?.contains(e.target as Node)) {
        setAddOpen(false);
        setModelOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 280) + "px";
  }, [value]);

  const currentModel = MODELS.find((m) => m.id === model) || MODELS[0];

  function brandMark(brand: string): React.ReactNode {
    switch (brand) {
      case "anthropic": return I.anthropicMark;
      case "google":    return I.geminiMark;
      default:          return <span className="brand-fallback" />;
    }
  }

  function toggleConnector(id: string) {
    setActiveConnectorIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
  }


  async function send() {
    const text = value.trim();
    if (!text || sending) return;

    // Optimistically push the user message + a loading placeholder so the
    // transcript animates open immediately.
    const userId = `u-${Date.now()}`;
    const loadingId = `l-${Date.now()}`;
    setMessages((cur) => [
      ...cur,
      { id: userId, role: "user", content: text },
      { id: loadingId, role: "loading" },
    ]);
    setValue("");
    setSending(true);

    try {
      let spaceContext: unknown[] = [];
      if (activeSpaceId) {
        try {
          spaceContext = await spacesApi.context(activeSpaceId, text);
        } catch {
          // Non-fatal: chat still proceeds without space grounding.
        }
      }
      const useMcps = activeConnectorIds.length > 0 ? activeConnectorIds : ["pubmed"];

      // Lazily create the persisted chat row on the first turn (so we don't
      // pollute history with empty drafts). Title = first 80 chars of the
      // user's first message. Best-effort — if it fails (401, etc.) we
      // still let the chat happen, just unpersisted.
      let activeChatId = chatId;
      if (!activeChatId) {
        try {
          const created = await chatsApi.create(text, model, "bedside");
          activeChatId = created.id;
          setChatId(created.id);
          // Stamp the URL so a reload restores this conversation. Push to
          // history with replaceState so the back button doesn't ping-pong.
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.set("c", created.id);
            url.searchParams.delete("n");
            window.history.replaceState({}, "", url.toString());
          }
        } catch { /* persistence is best-effort */ }
      }
      // Persist the user turn (also best-effort).
      if (activeChatId) {
        chatsApi.append(activeChatId, { role: "user", content: text }).catch(() => {});
      }

      const body = JSON.stringify({
        model, mode: "bedside", locale,
        messages: [
          ...messages.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({
            role: m.role,
            content: "content" in m ? m.content : "",
          })),
          { role: "user", content: text },
        ],
        useMcps, spaceContext,
        spaceName: activeSpace?.name || "",
      });

      // Stream via /api/chat/stream — server emits SSE events
      // (status / citations / content / error / done). The content event
      // currently carries the full completion in one shot (the backend
      // doesn't proxy provider-side streaming yet), so we typewriter-animate
      // it on the client to give the Claude/Gemini "watch it write" feel.
      const r = await fetch("/api/backend/api/chat/stream", {
        method: "POST",
        headers: { "content-type": "application/json", "accept": "text/event-stream" },
        credentials: "include",
        body,
      });
      if (!r.ok || !r.body) {
        throw new Error(`HTTP ${r.status}`);
      }

      const assistantId = `a-${Date.now()}`;
      // Swap the loading row for a real assistant row (empty content; we'll
      // append chunks into it as they arrive).
      setMessages((cur) =>
        cur
          .filter((m) => m.id !== loadingId)
          .concat({ id: assistantId, role: "assistant", content: "" })
      );

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let citationsForTurn: Citation[] | undefined;
      let finalContent = ""; // accumulated text — used to persist + as a sanity copy

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE frames separated by blank lines.
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
            setMessages((cur) =>
              cur.map((m) =>
                m.id === assistantId && m.role === "assistant"
                  ? { ...m, citations: citationsForTurn }
                  : m,
              ),
            );
          } else if (event === "delta" && typeof parsed?.text === "string") {
            // Real provider-side streaming: each delta is a token (or small
            // chunk). Append to the in-flight assistant message immediately.
            finalContent += parsed.text;
            const next = finalContent;
            setMessages((cur) =>
              cur.map((m) =>
                m.id === assistantId && m.role === "assistant"
                  ? { ...m, content: next, citations: citationsForTurn }
                  : m,
              ),
            );
          } else if (event === "content" && parsed?.content) {
            // Final 'content' carries the canonical full text. If we received
            // deltas we already have it; otherwise this is the only place we
            // ever set the body (legacy non-streaming providers).
            if (finalContent === "") {
              finalContent = parsed.content;
              setMessages((cur) =>
                cur.map((m) =>
                  m.id === assistantId && m.role === "assistant"
                    ? { ...m, content: parsed.content, citations: citationsForTurn }
                    : m,
                ),
              );
            }
          } else if (event === "error" && parsed?.error) {
            setMessages((cur) =>
              cur.map((m) =>
                m.id === assistantId && m.role === "assistant"
                  ? { ...m, content: "Error: " + parsed.error }
                  : m,
              ),
            );
            finalContent = ""; // don't persist a broken turn
          }
          // 'status' + 'done' are advisory only.
        }
      }

      // Persist the assistant turn (best-effort, fire and forget).
      if (activeChatId && finalContent !== "") {
        chatsApi.append(activeChatId, {
          role: "assistant",
          content: finalContent,
          citations: citationsForTurn ?? [],
        }).catch(() => {});
      }
    } catch (e: any) {
      setMessages((cur) =>
        cur
          .filter((m) => m.id !== loadingId)
          .concat({ id: `a-${Date.now()}`, role: "assistant", content: "Error: " + e.message })
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="composer" ref={composerRef}>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={s.placeholder}
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
          data-open={addOpen}
          onClick={() => { setAddOpen((v) => !v); setModelOpen(false); }}
          aria-label="Add"
        >
          {I.plus}
        </button>

        {activeSpace && (
          <button
            type="button"
            className="model-pill"
            onClick={() => setActiveSpaceId("")}
            title="Clear space"
            style={{ background: "var(--cyan-soft)", color: "var(--cyan)", borderColor: "var(--cyan-line)" }}
          >
            📁 {activeSpace.name} ×
          </button>
        )}
        {activeConnectorIds.slice(0, 3).map((id) => {
          const c = userConnectors.find((x) => x.mcpId === id);
          if (!c) return null;
          return (
            <button
              key={id}
              type="button"
              className="model-pill"
              onClick={() => toggleConnector(id)}
              title="Remove from this chat"
              style={{ background: "var(--cyan-soft)", color: "var(--cyan)", borderColor: "var(--cyan-line)", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <ConnectorIcon id={c.mcpId} name={c.name} iconUrl={c.iconUrl} size={16} />
              {c.name} ×
            </button>
          );
        })}
        {activeConnectorIds.length > 3 && (
          <span className="model-pill" style={{ background: "var(--cyan-soft)", color: "var(--cyan)" }}>
            +{activeConnectorIds.length - 3}
          </span>
        )}

        {addOpen && (
          <div className="popover" role="menu" style={{ maxHeight: 460, overflowY: "auto" }}>
            <div className="pop-header">{s.addConnector}</div>

            <Link href="/spaces" className="popover-row" style={{ textDecoration: "none" }}>
              {I.folder}
              <span className="col">
                <span className="ttl">{s.addFile}</span>
                <span className="desc">{s.addFileDesc}</span>
              </span>
            </Link>

            {userSpaces.length > 0 && (
              <>
                <div className="popover-sep" />
                <div className="pop-header">{s.spaces}</div>
                {userSpaces.map((sp) => (
                  <button
                    key={sp.id}
                    type="button"
                    className="popover-row"
                    data-active={activeSpaceId === sp.id}
                    onClick={() => {
                      setActiveSpaceId(activeSpaceId === sp.id ? "" : sp.id);
                      setAddOpen(false);
                    }}
                  >
                    {I.spaces}
                    <span className="col">
                      <span className="ttl">{sp.name}</span>
                      <span className="desc">{sp.fileCount} file{sp.fileCount === 1 ? "" : "s"}</span>
                    </span>
                    {activeSpaceId === sp.id && <span className="check" style={{ color: "var(--cyan)" }}>{I.check}</span>}
                  </button>
                ))}
              </>
            )}

            <div className="popover-sep" />
            <div className="pop-header">{s.connectors}</div>
            {userConnectors.length === 0 ? (
              <Link href="/mcps" className="popover-row" style={{ textDecoration: "none" }}>
                {I.link}
                <span className="col">
                  <span className="ttl">{s.addConnector}</span>
                  <span className="desc">{s.addConnectorDesc}</span>
                </span>
              </Link>
            ) : (
              <>
                {userConnectors.map((c) => {
                  const on = activeConnectorIds.includes(c.mcpId);
                  return (
                    <button
                      key={c.mcpId}
                      type="button"
                      className="popover-row"
                      data-active={on}
                      onClick={() => toggleConnector(c.mcpId)}
                    >
                      <ConnectorIcon id={c.mcpId} name={c.name} iconUrl={c.iconUrl} size={22} />
                      <span className="col">
                        <span className="ttl">{c.name}</span>
                        <span className="desc">{c.category}</span>
                      </span>
                      {on && <span className="check" style={{ color: "var(--cyan)" }}>{I.check}</span>}
                    </button>
                  );
                })}
                <Link href="/mcps" className="popover-row" style={{ textDecoration: "none", borderTop: "1px solid var(--border)" }}>
                  {I.plus}
                  <span className="col"><span className="ttl">{s.addConnector}</span></span>
                </Link>
              </>
            )}
          </div>
        )}

        <span className="spacer" />
        <div style={{ position: "relative" }}>
          <button className="model-pill" type="button" data-open={modelOpen} onClick={() => { setModelOpen((v) => !v); setAddOpen(false); }}>
            <span className="brand-mark">{brandMark(currentModel.brand)}</span>
            <span>{currentModel.short}</span>
            {I.chev}
          </button>
          {modelOpen && (
            <div className="model-pop" role="menu">
              <div className="pop-header">{s.modelHeader}</div>
              {MODELS.map((m) => (
                <button key={m.id} className="model-row" type="button" data-active={model === m.id} onClick={() => { setModel(m.id); setModelOpen(false); }}>
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
        <button className="cmpr-icon" type="button" data-on={voiceOn} onClick={() => setVoiceOn((v) => !v)} aria-label="Mic">{I.mic}</button>
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
  );
}
