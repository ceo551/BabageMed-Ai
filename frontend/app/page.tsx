"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { STR, MODELS, type Locale, type LocaleStrings } from "./i18n";
import { I } from "./icons";
import { useAuth } from "./lib/auth-context";
import { ConnectorIcon } from "./components/ConnectorIcon";
import {
  spaces as spacesApi,
  connectors as connectorsApi,
  type Space,
  type Connector,
} from "./lib/api";

type Theme = "light" | "dark" | "system";

export default function Dashboard() {
  const [locale, setLocale] = useState<Locale>("en");
  const [theme, setTheme] = useState<Theme>("system");
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("dark");
  const [collapsed, setCollapsed] = useState(false);
  const [model, setModel] = useState<string>("opus-4.7");
  const [mode, setMode] = useState<string>("bedside");
  // Per-message overrides chosen from the composer "+" popover. Both reset on
  // every new chat (which today just clears the input + reply).
  const [activeSpaceId, setActiveSpaceId] = useState<string>("");
  const [activeConnectorIds, setActiveConnectorIds] = useState<string[]>([]);

  const s = STR[locale];
  const effectiveTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    setSystemTheme(mq.matches ? "light" : "dark");
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? "light" : "dark");
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  useEffect(() => {
    const r = document.documentElement;
    r.setAttribute("lang", locale);
    r.setAttribute("dir", s.dir);
    r.setAttribute("data-theme", effectiveTheme);
  }, [locale, effectiveTheme, s.dir]);

  return (
    <div className="shell" data-collapsed={collapsed} data-screen-label="01 Dashboard home">
      <Sidebar
        s={s}
        collapsed={collapsed}
        onCollapse={() => setCollapsed((v) => !v)}
        locale={locale}
        setLocale={setLocale}
        theme={theme}
        setTheme={setTheme}
        effectiveTheme={effectiveTheme}
      />
      <main className="main">
        <section className="stage">
          <div className="stage-inner">
            <h1 className="greet">
              {I.star}
              <span className="brand-greet">
                <span className="b1">Babage</span>
                <span className="b2">Med</span>
                <em className="b3"> Ai</em>
              </span>
            </h1>
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
            />
            <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, margin: 0 }}>{s.disclaim}</p>
          </div>
        </section>
      </main>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
// Flat layout (no nested account menu): the existing top section keeps its
// labels in the expanded view, while every bottom row collapses to a single
// icon button when the sidebar is narrow — matching the reference mock the
// user supplied.
function Sidebar({
  s, collapsed, onCollapse, locale, setLocale, theme, setTheme, effectiveTheme,
}: {
  s: LocaleStrings;
  collapsed: boolean;
  onCollapse: () => void;
  locale: Locale;
  setLocale: (l: Locale) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  effectiveTheme: "light" | "dark";
}) {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const displayName = user?.displayName || user?.email?.split("@")[0] || s.user;
  const initials = (user?.displayName || user?.email || "AR")
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "AR";

  function cycleTheme() {
    const next: Theme = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
    setTheme(next);
  }
  function toggleLocale() {
    setLocale(locale === "en" ? "ar" : "en");
  }
  function startNewChat() {
    // Today "New" just navigates home with a hard refresh so all per-message
    // composer state resets. When chat persistence lands this becomes
    // /chat/new.
    router.push("/");
    if (typeof window !== "undefined") window.location.reload();
  }

  const themeIcon = effectiveTheme === "light" ? I.sun : I.moon;
  const themeLabel = theme === "system" ? `${s.themeSystem}` : theme === "light" ? s.themeLight : s.themeDark;

  return (
    <aside className="sidebar" aria-label="Sidebar">
      <div className="sb-head">
        <a className="sb-brand" href="/">
          {I.discLogo}
          <span className="wm">
            <span className="b1">Babage</span>
            <span className="b2">Med</span>
            <span className="b3">AI</span>
          </span>
        </a>
        <button className="sb-collapse" onClick={onCollapse} aria-label="Collapse sidebar">
          {I.sidebar}
        </button>
      </div>

      <div className="sb-body">
        <button className="sb-new" type="button" title={s.new} onClick={startNewChat}>
          {I.plus}
          <span className="lbl">{s.new}</span>
          <span className="kbd">⌘ K</span>
        </button>

        <Link href="/spaces" className="sb-row" style={{ textDecoration: "none" }}>
          {I.spaces}
          <span className="lbl">{s.spaces}</span>
          <span className="trail-chev">{I.chevR}</span>
        </Link>
        <button className="sb-row" type="button" disabled title={s.recent} style={{ opacity: 0.6, cursor: "not-allowed" }}>
          {I.history}
          <span className="lbl">{s.recent}</span>
          <span className="trail-chev">{I.chevR}</span>
        </button>
        <Link href="/mcps" className="sb-row" style={{ textDecoration: "none" }}>
          {I.connectors}
          <span className="lbl">{s.connectors}</span>
          <span className="trail-chev">{I.chevR}</span>
        </Link>
      </div>

      <div className="sb-foot sb-foot-flat">
        {user ? (
          <Link
            href="/billing"
            className="sb-account"
            title={`${displayName} · ${user.plan} plan`}
            style={{ textDecoration: "none" }}
          >
            <span className="av">{initials}</span>
            <span className="who">
              <span className="nm">{displayName}</span>
              <span className="pl">{user.plan} plan</span>
            </span>
          </Link>
        ) : (
          <div style={{ display: "flex", gap: 6 }}>
            <Link
              href="/login"
              className="sb-row"
              style={{
                flex: 1,
                justifyContent: "center",
                textDecoration: "none",
                border: "1px solid var(--border)",
              }}
            >
              <span className="lbl">Sign in</span>
            </Link>
            <Link
              href="/signup"
              className="sb-row"
              style={{
                flex: 1,
                justifyContent: "center",
                textDecoration: "none",
                background: "var(--cyan-soft)",
                color: "var(--cyan)",
                border: "1px solid var(--cyan-line)",
              }}
            >
              <span className="lbl">Sign up</span>
            </Link>
          </div>
        )}

        <button className="sb-row" type="button" onClick={cycleTheme} title={`${s.appearance}: ${themeLabel}`}>
          <span className="swatch-square">{themeIcon}</span>
          <span className="lbl">{themeLabel}</span>
        </button>
        <button className="sb-row" type="button" onClick={toggleLocale} title={`${s.language}: ${locale === "en" ? s.langEN : s.langAR}`}>
          <span className="swatch-square">{I.globe}</span>
          <span className="lbl">{locale === "en" ? s.langEN : s.langAR}</span>
        </button>
        <Link href="/admin" className="sb-row" style={{ textDecoration: "none" }} title={s.settings}>
          <span className="swatch-square">{I.gear}</span>
          <span className="lbl">{s.settings}</span>
        </Link>
        <Link href="/billing" className="sb-row" style={{ textDecoration: "none" }} title={s.plans}>
          <span className="swatch-square y">{I.bolt}</span>
          <span className="lbl">{s.plans}</span>
        </Link>
        {user && (
          <button
            className="sb-row"
            type="button"
            onClick={async () => { await signOut(); router.push("/"); }}
            title={s.logout}
          >
            <span className="swatch-square p">{I.logout}</span>
            <span className="lbl">{s.logout}</span>
          </button>
        )}
      </div>
    </aside>
  );
}

// ─── Composer ────────────────────────────────────────────────────────────────
function Composer({
  s, locale, model, setModel,
  activeSpaceId, setActiveSpaceId,
  activeConnectorIds, setActiveConnectorIds,
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
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [value, setValue] = useState("");
  const [voiceOn, setVoiceOn] = useState(false);
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState<string>("");
  const [userSpaces, setUserSpaces] = useState<Space[]>([]);
  const [userConnectors, setUserConnectors] = useState<Connector[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  // Pull the user's spaces + connectors once. Both endpoints require auth; if
  // they 401 the popover just shows the empty-state CTA.
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

  // Maps the MODELS entry's `brand` field to the matching SVG mark in
  // icons.tsx. Returns a sensible placeholder so the picker still renders
  // if a new vendor is added before its logo lands.
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
    if (!value.trim() || sending) return;
    setSending(true);
    setReply("");
    try {
      // If a space is selected, pull the most relevant chunks first so we can
      // include them in the chat payload as `spaceContext`.
      let spaceContext: unknown[] = [];
      if (activeSpaceId) {
        try {
          spaceContext = await spacesApi.context(activeSpaceId, value);
        } catch {
          // Non-fatal: chat still proceeds without space grounding.
        }
      }
      // useMcps comes from the user-picked connectors; if none, default to
      // pubmed so the chat still gets at least one retrieval source.
      const useMcps = activeConnectorIds.length > 0 ? activeConnectorIds : ["pubmed"];
      const r = await fetch("/api/backend/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          model,
          mode: "bedside",
          locale,
          messages: [{ role: "user", content: value }],
          useMcps,
          spaceContext,
          spaceName: activeSpace?.name || "",
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

  return (
    <>
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

          {/* In-bar pills for active selection — Claude-style chips. */}
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
      {reply && (
        <div style={{ background: "var(--panel-solid)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, color: "var(--ink)", whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 14 }}>
          {reply}
        </div>
      )}
    </>
  );
}
