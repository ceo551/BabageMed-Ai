"use client";

import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { STR, MODELS, type Locale, type LocaleStrings } from "./i18n";
import { I } from "./icons";
import { useAuth } from "./lib/auth-context";
import { spaces as spacesApi, type Space } from "./lib/api";

type Theme = "light" | "dark" | "system";

export default function Dashboard() {
  const [locale, setLocale] = useState<Locale>("en");
  const [theme, setTheme] = useState<Theme>("system");
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("dark");
  const [collapsed, setCollapsed] = useState(false);
  const [model, setModel] = useState<string>("opus-4.7");
  const [mode, setMode] = useState<string>("bedside");

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
            <Composer s={s} locale={locale} model={model} setModel={setModel} mode={mode} setMode={setMode} />
            <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, margin: 0 }}>{s.disclaim}</p>
          </div>
        </section>
      </main>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
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
  const { user, signOut } = useAuth();
  const [recentsOpen, setRecentsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [subOpen, setSubOpen] = useState<null | "appearance" | "language">(null);

  const displayName = user?.displayName || user?.email?.split("@")[0] || s.user;
  const planLabel   = user ? `${user.plan} plan` : s.plan;
  const initials    = (user?.displayName || user?.email || "AR")
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "AR";
  const [recentsPopStyle, setRecentsPopStyle] = useState<React.CSSProperties>({});
  const [accountPopStyle, setAccountPopStyle] = useState<React.CSSProperties>({});
  const [subStyle, setSubStyle] = useState<React.CSSProperties>({});

  const recentsBtn = useRef<HTMLButtonElement>(null);
  const accountBtn = useRef<HTMLButtonElement>(null);
  const recentsPop = useRef<HTMLDivElement>(null);
  const accountPop = useRef<HTMLDivElement>(null);

  function posPop(btn: React.RefObject<HTMLButtonElement>, setter: (s: React.CSSProperties) => void, above?: boolean) {
    const el = btn.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const sb = document.querySelector(".sidebar")?.getBoundingClientRect();
    const dir = document.documentElement.dir || "ltr";
    if (above) {
      const bottom = window.innerHeight - r.top + 8;
      if (dir === "rtl") setter({ position: "fixed", bottom, right: window.innerWidth - r.right, width: r.width, zIndex: 40 });
      else setter({ position: "fixed", bottom, left: r.left, width: r.width, zIndex: 40 });
      return;
    }
    if (dir === "rtl") setter({ position: "fixed", top: r.top, right: window.innerWidth - (sb?.left || r.left) + 8, zIndex: 40 });
    else setter({ position: "fixed", top: r.top, left: (sb?.right || r.right) + 8, zIndex: 40 });
  }

  const toggleRecents = () => {
    if (!recentsOpen) { posPop(recentsBtn, setRecentsPopStyle); setAccountOpen(false); }
    setRecentsOpen(v => !v);
  };
  const toggleAccount = () => {
    if (!accountOpen) { posPop(accountBtn, setAccountPopStyle, true); setRecentsOpen(false); }
    else setSubOpen(null);
    setAccountOpen(v => !v);
  };

  function openSub(name: "appearance" | "language" | null, e: React.MouseEvent<HTMLButtonElement>) {
    const row = e.currentTarget.getBoundingClientRect();
    const sb = document.querySelector(".sidebar")?.getBoundingClientRect();
    const dir = document.documentElement.dir || "ltr";
    if (sb) {
      if (dir === "rtl") setSubStyle({ position: "fixed", top: row.top, right: window.innerWidth - sb.left + 8, zIndex: 41 });
      else setSubStyle({ position: "fixed", top: row.top, left: sb.right + 8, zIndex: 41 });
    }
    setSubOpen(name);
  }

  useEffect(() => {
    if (!accountOpen && !recentsOpen) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (recentsOpen && !recentsPop.current?.contains(target) && !recentsBtn.current?.contains(target)) setRecentsOpen(false);
      if (accountOpen && !accountPop.current?.contains(target) && !accountBtn.current?.contains(target) && !document.querySelector(".sub-pop")?.contains(target)) {
        setAccountOpen(false); setSubOpen(null);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [recentsOpen, accountOpen]);

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
        <button className="sb-new" type="button" title={s.new}>
          {I.plus}
          <span className="lbl">{s.new}</span>
          <span className="kbd">⌘ K</span>
        </button>

        <Link href="/spaces" className="sb-row" style={{ textDecoration: "none" }}>
          {I.spaces}
          <span className="lbl">{s.spaces}</span>
          <span className="trail-chev">{I.chevR}</span>
        </Link>
        <button ref={recentsBtn} className="sb-row" type="button" data-active={recentsOpen} onClick={toggleRecents} aria-expanded={recentsOpen}>
          {I.history}
          <span className="lbl">{s.recent}</span>
          <span className="trail-chev">{I.chevR}</span>
        </button>
        <Link href="/mcps" className="sb-row" style={{ textDecoration: "none" }}>
          {I.connectors}
          <span className="lbl">MCPs</span>
          <span className="trail-chev">{I.chevR}</span>
        </Link>
      </div>

      <div className="sb-foot">
        {user ? (
          <button ref={accountBtn} className="sb-account" type="button" data-active={accountOpen} onClick={toggleAccount} aria-expanded={accountOpen}>
            <span className="av">{initials}</span>
            <span className="who">
              <span className="nm">{displayName}</span>
              <span className="pl">{planLabel}</span>
            </span>
            <span className="chev">{I.chevR}</span>
          </button>
        ) : (
          <div style={{ display: "flex", gap: 6 }}>
            <Link href="/login"  className="sb-row" style={{ flex: 1, justifyContent: "center", textDecoration: "none", borderColor: "var(--border)", border: "1px solid var(--border)" }}>Sign in</Link>
            <Link href="/signup" className="sb-row" style={{ flex: 1, justifyContent: "center", textDecoration: "none", background: "var(--cyan-soft)", color: "var(--cyan)", border: "1px solid var(--cyan-line)" }}>Sign up</Link>
          </div>
        )}
      </div>

      {recentsOpen && (
        <div ref={recentsPop} className="tools-pop recents-pop" style={recentsPopStyle} role="menu">
          <div className="pop-header">{s.recent}</div>
          {s.recents.map((r) => (
            <button key={r.id} className="tool-row recent-row" type="button" title={r.t}>
              <span className={"swatch dot-only " + r.c}><span className="d"></span></span>
              <span className="col"><span className="ttl">{r.t}</span></span>
              <span className="status when">{r.w}</span>
            </button>
          ))}
        </div>
      )}

      {accountOpen && (
        <div ref={accountPop} className="tools-pop account-pop" style={accountPopStyle} role="menu">
          <div className="tool-row" style={{ pointerEvents: "none" }}>
            <span className="av" style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,var(--cyan),var(--purple))", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 13 }}>{initials}</span>
            <span className="col"><span className="ttl">{displayName}</span><span className="desc">{user?.email || planLabel}</span></span>
          </div>
          <div className="popover-sep" />
          <button className="tool-row" type="button" data-active={subOpen === "appearance"} onClick={(e) => openSub(subOpen === "appearance" ? null : "appearance", e)}>
            <span className="swatch">{effectiveTheme === "light" ? I.sun : I.moon}</span>
            <span className="col">
              <span className="ttl">{s.appearance}</span>
              <span className="desc">{theme === "system" ? `${s.themeSystem} (${effectiveTheme === "light" ? s.themeLight : s.themeDark})` : theme === "light" ? s.themeLight : s.themeDark}</span>
            </span>
            <span className="trail-chev">{I.chevR}</span>
          </button>
          <button className="tool-row" type="button" data-active={subOpen === "language"} onClick={(e) => openSub(subOpen === "language" ? null : "language", e)}>
            <span className="swatch">{I.globe}</span>
            <span className="col">
              <span className="ttl">{s.language}</span>
              <span className="desc">{locale === "en" ? s.langEN : s.langAR}</span>
            </span>
            <span className="trail-chev">{I.chevR}</span>
          </button>
          <div className="popover-sep" />
          <button className="tool-row" type="button">
            <span className="swatch">{I.gear}</span>
            <span className="col"><span className="ttl">{s.settings}</span><span className="desc">{s.settingsDesc}</span></span>
          </button>
          <a className="tool-row" href="/billing">
            <span className="swatch y">{I.bolt}</span>
            <span className="col"><span className="ttl">{s.plans}</span><span className="desc">{s.plansDesc}</span></span>
          </a>
          {user?.isAdmin && (
            <a className="tool-row" href="/admin">
              <span className="swatch p">{I.skills}</span>
              <span className="col"><span className="ttl">Admin</span><span className="desc">Users · payments · sessions</span></span>
            </a>
          )}
          <div className="popover-sep" />
          <button className="tool-row logout" type="button" onClick={async () => { await signOut(); setAccountOpen(false); }}>
            <span className="swatch p">{I.logout}</span>
            <span className="col"><span className="ttl">{s.logout}</span><span className="desc">{s.logoutDesc}</span></span>
          </button>
        </div>
      )}

      {accountOpen && subOpen === "appearance" && (
        <div className="tools-pop sub-pop" style={subStyle} role="menu">
          <button className="tool-row" type="button" data-active={theme === "light"} onClick={() => setTheme("light")}>
            <span className="swatch">{I.sun}</span><span className="ttl">{s.themeLight}</span>
            {theme === "light" && <span className="check-end">{I.check}</span>}
          </button>
          <button className="tool-row" type="button" data-active={theme === "dark"} onClick={() => setTheme("dark")}>
            <span className="swatch">{I.moon}</span><span className="ttl">{s.themeDark}</span>
            {theme === "dark" && <span className="check-end">{I.check}</span>}
          </button>
          <button className="tool-row" type="button" data-active={theme === "system"} onClick={() => setTheme("system")}>
            <span className="swatch">{I.monitor}</span><span className="ttl">{s.themeSystem}</span>
            {theme === "system" && <span className="check-end">{I.check}</span>}
          </button>
        </div>
      )}
      {accountOpen && subOpen === "language" && (
        <div className="tools-pop sub-pop" style={subStyle} role="menu">
          <button className="tool-row" type="button" data-active={locale === "en"} onClick={() => setLocale("en")}>
            <span className="swatch"><span className="mono-tag">EN</span></span><span className="ttl">{s.langEN}</span>
            {locale === "en" && <span className="check-end">{I.check}</span>}
          </button>
          <button className="tool-row" type="button" data-active={locale === "ar"} onClick={() => setLocale("ar")}>
            <span className="swatch"><span className="mono-tag">AR</span></span><span className="ttl">{s.langAR}</span>
            {locale === "ar" && <span className="check-end">{I.check}</span>}
          </button>
        </div>
      )}
    </aside>
  );
}

// ─── Composer ────────────────────────────────────────────────────────────────
function Composer({
  s, locale, model, setModel,
}: {
  s: LocaleStrings;
  locale: Locale;
  model: string;
  setModel: (m: string) => void;
  mode: string;
  setMode: (m: string) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [value, setValue] = useState("");
  const [voiceOn, setVoiceOn] = useState(false);
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState<string>("");
  const [userSpaces, setUserSpaces] = useState<Space[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState<string>("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  // Pull the user's spaces once. Endpoint requires auth; if it 401s we just
  // hide the picker.
  useEffect(() => {
    spacesApi.list().then(setUserSpaces).catch(() => setUserSpaces([]));
  }, []);

  const activeSpace = userSpaces.find((sp) => sp.id === activeSpaceId);

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
      const r = await fetch("/api/backend/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          model,
          mode: "bedside",
          locale,
          messages: [{ role: "user", content: value }],
          useMcps: ["pubmed"],
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
          <button className="add-btn" type="button" data-open={addOpen} onClick={() => { setAddOpen((v) => !v); setModelOpen(false); }} aria-label="Add">
            {I.plus}
          </button>
          {userSpaces.length > 0 && (
            <select
              value={activeSpaceId}
              onChange={(e) => setActiveSpaceId(e.target.value)}
              aria-label="Use space for context"
              style={{
                background: activeSpaceId ? "var(--cyan-soft)" : "var(--panel)",
                color: activeSpaceId ? "var(--cyan)" : "var(--ink)",
                border: `1px solid ${activeSpaceId ? "var(--cyan-line)" : "var(--border)"}`,
                borderRadius: 999,
                padding: "6px 10px",
                fontSize: 12,
              }}
            >
              <option value="">No space</option>
              {userSpaces.map((sp) => (
                <option key={sp.id} value={sp.id}>📁 {sp.name}</option>
              ))}
            </select>
          )}
          {addOpen && (
            <div className="popover" role="menu">
              <div className="pop-header">{s.addConnector}</div>
              <button className="popover-row" type="button">
                {I.link}
                <span className="col"><span className="ttl">{s.addConnector}</span><span className="desc">{s.addConnectorDesc}</span></span>
                <span className="chev" style={{ opacity: 0.5 }}>{I.chevR}</span>
              </button>
              <button className="popover-row" type="button">
                {I.folder}
                <span className="col"><span className="ttl">{s.addFile}</span><span className="desc">{s.addFileDesc}</span></span>
              </button>
              <div className="popover-sep" />
              <div className="pop-header">{s.fromTools}</div>
              <button className="popover-row" type="button">{I.doc}<span className="col"><span className="ttl">{s.epic}</span></span></button>
              <button className="popover-row" type="button">{I.doc}<span className="col"><span className="ttl">{s.pubmed}</span></span></button>
              <button className="popover-row" type="button">{I.doc}<span className="col"><span className="ttl">{s.kdigo}</span></span></button>
            </div>
          )}
          <span className="spacer" />
          <div style={{ position: "relative" }}>
            <button className="model-pill" type="button" data-open={modelOpen} onClick={() => { setModelOpen((v) => !v); setAddOpen(false); }}>
              <span className={"swatch " + currentModel.swatch}></span>
              <span>{currentModel.short}</span>
              {I.chev}
            </button>
            {modelOpen && (
              <div className="model-pop" role="menu">
                <div className="pop-header">{s.modelHeader}</div>
                {MODELS.map((m) => (
                  <button key={m.id} className="model-row" type="button" data-active={model === m.id} onClick={() => { setModel(m.id); setModelOpen(false); }}>
                    <span className={"swatch " + m.swatch}></span>
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
          <button className="cmpr-icon" type="button" onClick={send} aria-label="Send" disabled={sending} style={{ width: "auto", padding: "0 10px", color: "var(--cyan)", borderColor: "var(--cyan-line)", background: "var(--cyan-soft)" }}>
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
