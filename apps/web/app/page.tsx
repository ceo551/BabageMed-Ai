"use client";

import Link from "next/link";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MODELS, type Locale, type LocaleStrings } from "./i18n";
import { I } from "./icons";
import { useUI } from "./lib/ui-context";
import { useAuth } from "./lib/auth-context";
import { usePrefs, useSession, prefs, session } from "./lib/store";
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

// React-key generator for optimistic message rows. Falls back to a counter +
// Date.now() on environments without crypto.randomUUID (older Safari < 15.4,
// SSR contexts where the crypto polyfill hasn't loaded yet). The counter is
// what actually saves us from Date.now() collisions on rapid double-sends.
let __idCounter = 0;
function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  __idCounter = (__idCounter + 1) | 0;
  return `${Date.now().toString(36)}-${__idCounter.toString(36)}`;
}

// The single model anonymous (logged-out) visitors may use on the public home.
// Everything else is lock-iconed in the picker; clampForAnon enforces it too.
const ANON_MODEL = "deepseek-v4-pro";

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
  // Anonymous (logged-out) visitors get the public trial mode: deepseek only,
  // one un-saved conversation. `authLoading` guards against locking the picker
  // for a split second before a logged-in user resolves.
  const { user, loading: authLoading } = useAuth();
  const anon = !authLoading && !user;
  const params = useSearchParams();
  const chatIdParam = params?.get("c") || "";
  // 'n' is the cache-buster the sidebar's New button puts on the URL to
  // force a fresh chat even when we're already on /. Reading it here just
  // means the effect re-runs and clears state — value itself is ignored.
  const nonceParam = params?.get("n") || "";

  // Chat-lifecycle state stays local to the dashboard because it's
  // tightly coupled to the URL (?c=<id>) and the streaming-send pipeline.
  // Cross-page state (model / mode / draft / active connectors / active
  // space) lives in lib/store.ts so a quick trip to /mcps doesn't wipe
  // a half-typed message or the user's connector picks.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatId, setChatId] = useState<string>("");

  // Track which load is "live" so a fast switch (A → B → A) doesn't let
  // A's slow response overwrite B's messages. Belt-and-braces alongside
  // the AbortController in the Composer's streaming send.
  const liveChatLoadRef = useRef<string>("");

  // Sync chat state with the URL: ?c=<id> loads that chat, no ?c means
  // brand-new chat. The nonce param also forces a reset when clicking
  // "New" while already on /.
  useEffect(() => {
    if (chatIdParam) {
      // Load existing chat. Skip if it's already the active one.
      if (chatIdParam === chatId) return;
      setChatId(chatIdParam);
      const requestedId = chatIdParam;
      liveChatLoadRef.current = requestedId;
      chatsApi.messages(requestedId)
        .then((rows) => {
          if (requestedId !== liveChatLoadRef.current) return;
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
      // No chatId in URL → fresh chat. Reset conversation-scoped bits
      // (messages, chatId, active connectors + space) but DO keep the
      // user's model / mode picks across the "New" jump.
      setChatId("");
      setMessages([]);
      session.resetForNewChat();
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
            <img src="/pervagans-icon.png" alt="" aria-hidden="true" className="brand-greet-icon" />
            <span className="brand-greet">
              <span className="b1">Pervagans</span>
            </span>
          </h1>
        )}
      </div>
      {/* Composer is a sibling of .stage-inner, not a child, so it lives
        * outside the scrolling area. This is the Claude/Gemini layout
        * pattern — the transcript scrolls beneath a fixed composer dock
        * instead of using position:sticky, which "un-sticks" once the
        * user scrolls past the natural end of the column. */}
      <Composer
        s={s}
        locale={locale}
        anon={anon}
        messages={messages}
        setMessages={setMessages}
        chatId={chatId}
        setChatId={setChatId}
      />
    </section>
  );
}

// ─── Transcript ──────────────────────────────────────────────────────────────
// User turns render as right-aligned chips; assistant turns flow as plain
// prose (no chip) so multi-paragraph answers read naturally. The "loading"
// placeholder swaps in the pulsing brand mark while we're waiting on the LLM.
function Transcript({ messages }: { messages: ChatMessage[] }) {
  // Round 24 fix: read useUI here too so s.generating doesn't crash
  // at runtime (Transcript is a sibling component to Dashboard's
  // render, not a child — useUI in Dashboard doesn't pass `s` down).
  const { s } = useUI();
  const endRef = useRef<HTMLDivElement>(null);
  // Track whether the user has manually scrolled away from the bottom. When
  // they have, we stop auto-following the stream — yanking the viewport on
  // every delta while they're reading earlier output is the single biggest
  // chat-UX irritant we had. The threshold is generous (120px) so a small
  // overshoot from inertial scrolling doesn't lose the autofollow lock.
  const stickToBottomRef = useRef(true);
  useEffect(() => {
    // The scrolling area is .stage-inner now that the composer was lifted
    // out of it (see <section className="stage">…</section> structure).
    // We watch its scroll position to decide whether to stick the view to
    // the bottom as new tokens stream in.
    const scroller = endRef.current?.closest(".stage-inner") as HTMLElement | null;
    if (!scroller) return;
    function onScroll() {
      if (!scroller) return;
      const distFromBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      stickToBottomRef.current = distFromBottom < 120;
    }
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);
  useLayoutEffect(() => {
    if (!stickToBottomRef.current) return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="transcript" role="log" aria-live="polite" aria-relevant="additions text">
      {messages.map((m) => {
        if (m.role === "loading") {
          return (
            <div key={m.id} className="msg msg-assistant msg-loading">
              <img
                src="/pervagans-icon.png"
                alt=""
                className="msg-loading-mark"
                width={40}
                height={40}
                aria-hidden="true"
              />
              {/* Three-dot wave so the user sees a heartbeat while the
                  retrieval + first-token phases run. The pulse on the mark
                  alone wasn't visible enough on light theme. */}
              <span className="msg-loading-dots" aria-label={s.generating}>
                <span /><span /><span />
              </span>
            </div>
          );
        }
        if (m.role === "user") {
          return (
            <div key={m.id} className="msg-row msg-row-user">
              {/* dir="auto" so an Arabic chip flows RTL even on an
                * English page, and vice versa. */}
              <div className="msg msg-user" dir="auto">{m.content}</div>
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
  s, locale, anon,
  messages, setMessages,
  chatId, setChatId,
}: {
  s: LocaleStrings;
  locale: Locale;
  anon: boolean;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  chatId: string;
  setChatId: (id: string) => void;
}) {
  // Persisted prefs (model + mode) and in-memory session (draft, active
  // connectors / space) come from the shared store so they survive
  // navigation to /mcps, /spaces, etc. and back.
  const { model, mode } = usePrefs();
  const { draftText, activeSpaceId, activeConnectorIds } = useSession();
  const value = draftText;
  const setValue = session.setDraftText;
  const setModel = prefs.setModel;
  const setActiveSpaceId = session.setActiveSpaceId;
  const setActiveConnectorIds = (
    updater: string[] | ((cur: string[]) => string[]),
  ) => {
    const next = typeof updater === "function" ? updater(activeConnectorIds) : updater;
    session.setActiveConnectorIds(next);
  };
  // `mode` comes from the persisted prefs store (Fast / Deep / Cited).
  // Backend reads it via the chat request body — see send() below.

  const [addOpen, setAddOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [deepResearch, setDeepResearch] = useState(false);
  const [agentMode, setAgentMode] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userSpaces, setUserSpaces] = useState<Space[]>([]);
  const [userConnectors, setUserConnectors] = useState<Connector[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AbortController of the currently-streaming chat fetch. Switching chats
  // (or unmounting) aborts the previous stream so tokens don't keep
  // arriving and writing into stale React state.
  const streamAbortRef = useRef<AbortController | null>(null);
  // Mirror of chatId in a ref so the in-flight SSE loop can detect a
  // chat switch without taking a dependency on state and re-creating the
  // closure on every change.
  const activeChatIdRef = useRef<string>(chatId);
  useEffect(() => {
    if (activeChatIdRef.current && activeChatIdRef.current !== chatId) {
      streamAbortRef.current?.abort();
      streamAbortRef.current = null;
    }
    activeChatIdRef.current = chatId;
  }, [chatId]);
  // Abort on unmount.
  useEffect(() => () => { streamAbortRef.current?.abort(); }, []);

  // Stop the in-flight chat/agent stream (the composer's send button flips to a
  // Stop control while sending). Aborting triggers send()'s AbortError path,
  // which drops the loading row; we also clear sending for instant feedback.
  function stop() {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setSending(false);
  }

  // Click handler for the "Add file or folder" popover row. Opens the OS
  // file picker; onFilesChosen does the actual upload + space attach.
  function openFilePicker() {
    setAddOpen(false);
    fileInputRef.current?.click();
  }

  // Upload every chosen file to a Space and pin that space as the active
  // chat context. If no space is active yet we create a "Quick uploads"
  // space on the fly so the user doesn't have to detour through /spaces.
  async function onFilesChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    // Reset the input so picking the same file twice still triggers change.
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    try {
      let targetSpaceId = activeSpaceId;
      if (!targetSpaceId) {
        const created = await spacesApi.create({
          name: files[0].name.replace(/\.[^.]+$/, "") || "Quick uploads",
          description: "",
          icon: "📎",
          instructions: "",
        });
        setUserSpaces((cur) => [created, ...cur]);
        targetSpaceId = created.id;
        session.setActiveSpaceId(created.id);
      }
      // Upload in parallel with a concurrency cap; tolerate per-file
      // failures so a single bad PDF doesn't abort the whole batch.
      // Without the cap a user dragging 1000 files would fan out 1000
      // simultaneous 10 MB uploads (10 GB in flight) and OOM the
      // browser before the backend's per-file limit even kicks in.
      const concurrency = 4;
      const queue = files.slice();
      const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
        while (queue.length) {
          const f = queue.shift();
          if (!f) break;
          try { await spacesApi.upload(targetSpaceId!, f); } catch { /* per-file tolerant */ }
        }
      });
      await Promise.all(workers);
    } catch (err: any) {
      // Surface the failure in the transcript so the user knows the
      // attach didn't take. (We don't have a dedicated toast yet.)
      setMessages((cur) => [
        ...cur,
        {
          id: `a-${newId()}`,
          role: "assistant",
          content: "Couldn't attach those files: " + (err?.error || String(err)),
        },
      ]);
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    // Anonymous visitors have no spaces/connectors and these endpoints are
    // auth-gated — skip the doomed 401s entirely (the trial composer hides
    // the space/connector chips anyway).
    if (anon) { setUserSpaces([]); setUserConnectors([]); return; }
    spacesApi.list().then(setUserSpaces).catch(() => setUserSpaces([]));
    connectorsApi.list().then(setUserConnectors).catch(() => setUserConnectors([]));
  }, [anon]);

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
    // Escape closes both popovers — keyboard parity with click-outside.
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAddOpen(false);
        setModelOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 280) + "px";
  }, [value]);

  // Anonymous visitors are locked to deepseek (the one unlocked model); the
  // backend's clampForAnon enforces this server-side too.
  const currentModel = anon
    ? (MODELS.find((m) => m.id === ANON_MODEL) || MODELS[0])
    : (MODELS.find((m) => m.id === model) || MODELS[0]);

  function brandMark(brand: string): React.ReactNode {
    switch (brand) {
      case "anthropic":  return I.anthropicMark;
      case "google":     return I.geminiMark;
      case "openai":     return I.openaiMark;
      case "xai":        return I.xaiMark;
      case "deepseek":   return I.deepseekMark;
      case "alibaba":    return I.alibabaMark;
      case "zhipu":      return I.zhipuMark;
      case "kling":      return I.klingMark;
      case "bytedance":  return I.bytedanceMark;
      case "happyhorse": return I.happyhorseMark;
      default:           return <span className="brand-fallback" />;
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
    // Date.now() collisions are theoretically possible on rapid double-send;
    // crypto.randomUUID is universally available in evergreen browsers + Node,
    // and the resulting React keys can never collide across optimistic +
    // assistant + loading placeholders inside a single render.
    const userId = `u-${newId()}`;
    const loadingId = `l-${newId()}`;
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
      // Only ever search the connectors the user explicitly picked. Earlier
      // versions defaulted to ["pubmed"] which made PubMed show up as a
      // source on every conversation even when the user never added it.
      const useMcps = activeConnectorIds;

      // Lazily create the persisted chat row on the first turn (so we don't
      // pollute history with empty drafts). Title = first 80 chars of the
      // user's first message. Best-effort — if it fails (401, etc.) we
      // still let the chat happen, just unpersisted.
      let activeChatId = chatId;
      // Anonymous visitors get ONE un-saved conversation — never persist (the
      // chats API is auth-gated anyway; skipping avoids a doomed 401 + keeps
      // the trial chat out of any history).
      if (!activeChatId && !anon) {
        try {
          // Empty feature → dashboard "general" chat. Backend stores
          // feature_slug as NULL, which the sidebar's general History row
          // filters on (?feature=general).
          const created = await chatsApi.create(text, model, mode || "bedside", "");
          activeChatId = created.id;
          setChatId(created.id);
          // Stamp the URL so a reload restores this conversation. Push to
          // history with replaceState so the back button doesn't ping-pong.
          // Dispatch a custom event the Sidebar listens for so the new
          // chat title appears immediately — pathname doesn't change so
          // the sidebar's path-driven effect wouldn't refire.
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.set("c", created.id);
            url.searchParams.delete("n");
            window.history.replaceState({}, "", url.toString());
            window.dispatchEvent(new CustomEvent("pervagans:chat-created", { detail: { id: created.id } }));
          }
        } catch { /* persistence is best-effort */ }
      }
      // Persist the user turn (also best-effort).
      if (activeChatId) {
        chatsApi.append(activeChatId, { role: "user", content: text }).catch(() => {});
      }

      // Agent Mode: hand off to the plan→act→deliver loop over the connectors
      // (separate SSE endpoint + step rendering), then we're done.
      if (agentMode) {
        await runAgent(text, loadingId, activeChatId);
        return;
      }

      const body = JSON.stringify({
        // Send the VALIDATED model id (currentModel falls back to MODELS[0]
        // when the persisted `model` is stale/unknown), so the request body
        // always matches the pill the user sees instead of a corrupt
        // localStorage value the picker silently coerced for display only.
        model: currentModel.id, mode: mode || "bedside", locale,
        messages: [
          ...messages.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({
            role: m.role,
            content: "content" in m ? m.content : "",
          })),
          { role: "user", content: text },
        ],
        useMcps, spaceContext,
        spaceName: activeSpace?.name || "",
        enableWebSearch: webSearch || deepResearch,
        deepResearch,
      });

      // Stream via /api/chat/stream — server emits SSE events
      // (status / citations / content / error / done).
      // AbortController so chat switches / unmounts mid-stream actually
      // close the upstream connection instead of leaving it pulling tokens
      // into a stale closure (which would then setMessages on a dead chat).
      const controller = new AbortController();
      streamAbortRef.current?.abort();
      streamAbortRef.current = controller;
      const sendingForChat = activeChatId;
      const r = await fetch("/api/backend/api/chat/stream", {
        method: "POST",
        headers: { "content-type": "application/json", "accept": "text/event-stream" },
        credentials: "include",
        body,
        signal: controller.signal,
      });
      if (!r.ok || !r.body) {
        throw new Error(r.status === 402 ? s.quotaReached : `HTTP ${r.status}`);
      }

      const assistantId = `a-${newId()}`;
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
        // Normalise CRLF → LF on append — many proxies (nginx variants,
        // Azure Front Door, some CDNs) emit "\r\n\r\n" between SSE
        // frames; splitting on "\n\n" alone would leave a stray "\r"
        // that breaks JSON.parse on the data line.
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

        // Parse SSE frames separated by blank lines.
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          let event = "message";
          let data = "";
          for (const line of frame.split("\n")) {
            // Per SSE spec: "event:" / "data:" with an optional single space
            // after the colon. Accept both `data: foo` and `data:foo`.
            if (line.startsWith("event:")) {
              event = line.slice(line[6] === " " ? 7 : 6).trim();
            } else if (line.startsWith("data:")) {
              // Multi-line data fields are joined by '\n' per spec.
              data += (data ? "\n" : "") + line.slice(line[5] === " " ? 6 : 5);
            }
          }
          if (!data) continue;
          // If the user has switched chats while this stream is in flight,
          // drop further updates. The AbortController above should already
          // have killed the connection — this is belt-and-braces.
          if (sendingForChat !== activeChatIdRef.current) {
            controller.abort();
            return;
          }

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
            // Persist the error so a chat reload doesn't silently
            // drop it — the user saw "Error: …" on screen; if we
            // skip persistence the row vanishes on the next refresh
            // and the user is left wondering whether anything ran.
            finalContent = "Error: " + parsed.error;
          }
          // 'status' + 'done' are advisory only.
        }
      }

      // Persist the assistant turn (best-effort, fire and forget).
      // Skip only if we have literally nothing — a streamed answer
      // that produced zero bytes is the only case worth dropping.
      if (activeChatId && finalContent !== "") {
        chatsApi.append(activeChatId, {
          role: "assistant",
          content: finalContent,
          citations: citationsForTurn ?? [],
        }).catch(() => {});
      }
    } catch (e: unknown) {
      // Don't render an "Error: The user aborted a request" bubble when
      // the user simply switched chats / unmounted — the AbortController
      // above did its job; the stream is already orphaned to the new
      // chat's transcript and the old one shouldn't show anything.
      const err = e as { name?: string; message?: string };
      // Drop the loading row in all cases; surface real failures as a toast
      // (an intentional abort — chat switch / unmount — stays silent).
      setMessages((cur) => cur.filter((m) => m.id !== loadingId));
      if (err?.name !== "AbortError") {
        toast.error(err?.message || (locale === "ar" ? "حدث خطأ، حاول مرة أخرى" : "Something went wrong"));
      }
    } finally {
      setSending(false);
      streamAbortRef.current = null;
    }
  }

  // runAgent drives Agent Mode: POST the task to /api/agent/stream and render
  // the plan→act steps live, then the final answer, into one assistant turn.
  async function runAgent(text: string, loadingId: string, activeChatId: string) {
    const controller = new AbortController();
    streamAbortRef.current?.abort();
    streamAbortRef.current = controller;
    const r = await fetch("/api/backend/api/agent/stream", {
      method: "POST",
      headers: { "content-type": "application/json", "accept": "text/event-stream" },
      credentials: "include",
      body: JSON.stringify({ task: text, useMcps: activeConnectorIds, locale }),
      signal: controller.signal,
    });
    if (!r.ok || !r.body) throw new Error(r.status === 402 ? s.quotaReached : `HTTP ${r.status}`);
    const assistantId = `a-${newId()}`;
    setMessages((cur) => cur.filter((m) => m.id !== loadingId).concat({ id: assistantId, role: "assistant", content: "" }));

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const steps: string[] = [];
    let answer = "";
    let agentCites: Citation[] | undefined;
    const render = () => {
      const head = steps.length ? `**${s.agentWorking}**\n${steps.join("\n")}\n\n---\n\n` : "";
      const tail = answer || (steps.length ? `_${s.agentWorking}_` : "");
      const content = head + tail;
      setMessages((cur) => cur.map((m) => (m.id === assistantId && m.role === "assistant" ? { ...m, content } : m)));
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        let event = "message";
        let data = "";
        for (const line of frame.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(line[6] === " " ? 7 : 6).trim();
          else if (line.startsWith("data:")) data += (data ? "\n" : "") + line.slice(line[5] === " " ? 6 : 5);
        }
        if (!data) continue;
        let parsed: any = null;
        try { parsed = JSON.parse(data); } catch { /* ignore */ }
        if (event === "step" && parsed?.phase === "action") {
          steps.push(`- 🔧 \`${parsed.tool}\`${parsed.query ? ` — ${parsed.query}` : ""}`);
          render();
        } else if (event === "step" && parsed?.phase === "observation") {
          // P5: attach a live preview of what the tool returned/wrote to the
          // step it belongs to, so the work pane shows real progress.
          if (steps.length) {
            const mark = parsed.ok ? "✅" : "⚠️";
            let prev = typeof parsed.preview === "string" ? parsed.preview.replace(/\s+/g, " ").trim() : "";
            if (prev.length > 120) prev = prev.slice(0, 120) + "…";
            steps[steps.length - 1] += `\n  ↳ ${mark}${prev ? " " + prev : ""}`;
            render();
          }
        } else if (event === "answer" && typeof parsed?.content === "string") {
          answer = parsed.content;
          render();
        } else if (event === "sources" && Array.isArray(parsed)) {
          // P3: provenance for the agent's tool calls → numbered source cards.
          agentCites = parsed as Citation[];
          setMessages((cur) => cur.map((m) => (m.id === assistantId && m.role === "assistant" ? { ...m, citations: agentCites } : m)));
        } else if (event === "error") {
          toast.error(parsed?.error || (locale === "ar" ? "فشل الوكيل" : "Agent failed"));
          answer = answer || (locale === "ar" ? "⚠ تعذّر إكمال المهمة" : "⚠ Couldn't complete the task");
          render();
        }
      }
    }
    if (activeChatId && answer) {
      const head = steps.length ? `**${s.agentWorking}**\n${steps.join("\n")}\n\n---\n\n` : "";
      chatsApi.append(activeChatId, { role: "assistant", content: head + answer, citations: agentCites ?? [] }).catch(() => {});
    }
  }

  return (
    <div className="composer" ref={composerRef}>
      {/* Hidden picker driven by the "Add file or folder" popover row. */}
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
        placeholder={s.placeholder}
        aria-label={s.placeholder}
        rows={1}
        onKeyDown={(e) => {
          // Claude / ChatGPT / Gemini muscle memory: plain Enter sends, and
          // Shift+Enter inserts a newline. Avoid sending while IME composition
          // is in flight (Japanese / Chinese / Arabic accent stacks would
          // submit prematurely on the candidate-selection Enter).
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
          data-open={addOpen}
          onClick={() => { setAddOpen((v) => !v); setModelOpen(false); }}
          aria-label={s.addLabel}
        >
          {I.plus}
        </button>

        {activeSpace && (
          <button
            type="button"
            className="model-pill"
            onClick={() => setActiveSpaceId("")}
            title="Clear space"
            style={{ background: "var(--yellow-soft)", color: "var(--yellow)", borderColor: "var(--yellow-line)" }}
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
              style={{ background: "var(--purple-soft)", color: "var(--purple)", borderColor: "var(--purple-line)", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <ConnectorIcon id={c.mcpId} name={c.name} iconUrl={c.iconUrl} size={16} />
              {c.name} ×
            </button>
          );
        })}
        {activeConnectorIds.length > 3 && (
          <span className="model-pill" style={{ background: "var(--purple-soft)", color: "var(--purple)" }}>
            +{activeConnectorIds.length - 3}
          </span>
        )}
        {webSearch && (
          <button
            type="button"
            className="model-pill ws-chip"
            onClick={() => setWebSearch(false)}
            title={s.webSearch}
            style={{ background: "var(--cyan-soft)", color: "var(--cyan)", border: "1px solid var(--cyan-line)", display: "inline-flex", alignItems: "center" }}
          >
            {I.globe}{s.webSearch} ×
          </button>
        )}
        {deepResearch && (
          <button
            type="button"
            className="model-pill ws-chip"
            onClick={() => setDeepResearch(false)}
            title={s.deepResearch}
            style={{ background: "var(--indigo-soft)", color: "var(--indigo)", border: "1px solid var(--indigo-line)", display: "inline-flex", alignItems: "center" }}
          >
            {I.globe}{s.deepResearch} ×
          </button>
        )}
        {agentMode && (
          <button
            type="button"
            className="model-pill ws-chip"
            onClick={() => setAgentMode(false)}
            title={s.agentMode}
            style={{ background: "var(--fuchsia-soft)", color: "var(--fuchsia)", border: "1px solid var(--fuchsia-line)", display: "inline-flex", alignItems: "center" }}
          >
            {I.agent}{s.agentMode} ×
          </button>
        )}

        {addOpen && (
          <div className="popover" role="menu">
            <button
              type="button"
              className="popover-row"
              onClick={openFilePicker}
              disabled={uploading}
              style={{ width: "100%", textAlign: "start", border: 0, background: "transparent", cursor: uploading ? "progress" : "pointer" }}
            >
              {I.folder}
              <span className="col">
                <span className="ttl">{uploading ? "Uploading…" : s.addFile}</span>
              </span>
            </button>
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
            <button
              type="button"
              className="popover-row"
              aria-pressed={deepResearch}
              onClick={() => { setDeepResearch((v) => !v); setAddOpen(false); }}
              style={{ width: "100%", textAlign: "start", border: 0, background: "transparent", cursor: "pointer" }}
            >
              {I.research}
              <span className="col">
                <span className="ttl">{s.deepResearch}</span>
                <span className="desc">{s.deepResearchDesc}</span>
              </span>
              {deepResearch && <span className="check" style={{ opacity: 1 }}>{I.check}</span>}
            </button>
            <button
              type="button"
              className="popover-row"
              aria-pressed={agentMode}
              onClick={() => { setAgentMode((v) => !v); setAddOpen(false); }}
              style={{ width: "100%", textAlign: "start", border: 0, background: "transparent", cursor: "pointer" }}
            >
              {I.agent}
              <span className="col">
                <span className="ttl">{s.agentMode}</span>
                <span className="desc">{s.agentModeDesc}</span>
              </span>
              {agentMode && <span className="check" style={{ opacity: 1 }}>{I.check}</span>}
            </button>
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
              {MODELS.map((m) => {
                // Anonymous: every model except deepseek is locked → clicking
                // nudges to sign-in instead of selecting it.
                const locked = anon && m.id !== ANON_MODEL;
                return (
                  <button
                    key={m.id}
                    className="model-row"
                    type="button"
                    data-active={currentModel.id === m.id}
                    onClick={() => {
                      if (locked) { window.location.href = "/login"; return; }
                      setModel(m.id);
                      setModelOpen(false);
                    }}
                    title={locked ? (locale === "ar" ? "سجّل الدخول لفتح هذا النموذج" : "Sign in to unlock this model") : undefined}
                    style={locked ? { opacity: 0.55 } : undefined}
                  >
                    <span className="brand-mark">{brandMark(m.brand)}</span>
                    <span className="col">
                      <span className="nm">{m.name}</span>
                      <span className="meta-row">
                        {m.pills[locale].map((p, i) => <span key={i} className="pill">{p}</span>)}
                      </span>
                    </span>
                    <span className="check">{locked ? I.lock : I.check}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <button className="cmpr-icon" type="button" data-on={voiceOn} onClick={() => setVoiceOn((v) => !v)} aria-label={s.micLabel}>{I.mic}</button>
        <button
          className="cmpr-icon cmpr-send"
          type="button"
          onClick={sending ? stop : send}
          aria-label={sending ? s.stop : s.send}
          title={sending ? s.stop : s.send}
          disabled={!sending && value.trim() === ""}
          // Send/stop button — state drives the CSS (.cmpr-send[data-state]).
          // While sending it becomes a Stop control (abort the stream).
          data-state={sending ? "sending" : value.trim() === "" ? "idle" : "ready"}
        >
          {sending ? I.stop : I.send}
        </button>
      </div>
    </div>
  );
}
