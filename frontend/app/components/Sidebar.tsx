"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { I } from "../icons";
import { useAuth } from "../lib/auth-context";
import { useUI } from "../lib/ui-context";

// Sidebar — persistent across pages (mounted by AppShell).
//
// Top section: brand + collapse toggle, New chat button, primary nav
// (Spaces, History, Connectors).
// Bottom: a single account chip. Clicking it opens a Claude-style popover
// floating above with Appearance / Language / Settings / Plans / Logout
// rows. Two nested sub-popovers (Appearance, Language) flyout to the side.
export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { locale, setLocale, theme, setTheme, effectiveTheme, toggleCollapsed, s } = useUI();

  const displayName = user?.displayName || user?.email?.split("@")[0] || s.user;
  const initials = (user?.displayName || user?.email || "AR")
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "AR";

  function startNewChat() {
    if (pathname !== "/") {
      // Different page → push home; the dashboard mounts fresh so the composer
      // is empty by default.
      router.push("/");
    } else {
      // Already home → bump a refresh param so React remounts the page subtree
      // and resets the composer without a hard browser reload.
      router.replace(`/?n=${Date.now()}`);
    }
  }

  return (
    <aside className="sidebar" aria-label="Sidebar">
      <div className="sb-head">
        <Link className="sb-brand" href="/">
          {I.discLogo}
          <span className="wm">
            <span className="b1">Babage</span>
            <span className="b2">Med</span>
            <span className="b3">AI</span>
          </span>
        </Link>
        <button className="sb-collapse" onClick={toggleCollapsed} aria-label="Collapse sidebar">
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

      <div className="sb-foot">
        {user ? (
          <AccountChip
            displayName={displayName}
            initials={initials}
            plan={user.plan}
            email={user.email}
            isAdmin={user.isAdmin}
            locale={locale}
            setLocale={setLocale}
            theme={theme}
            setTheme={setTheme}
            effectiveTheme={effectiveTheme}
            s={s}
            onSignOut={async () => { await signOut(); router.push("/"); }}
          />
        ) : (
          <div style={{ display: "flex", gap: 6 }}>
            <Link
              href="/login"
              className="sb-row"
              style={{
                flex: 1, justifyContent: "center", textDecoration: "none",
                border: "1px solid var(--border)",
              }}
            ><span className="lbl">Sign in</span></Link>
            <Link
              href="/signup"
              className="sb-row"
              style={{
                flex: 1, justifyContent: "center", textDecoration: "none",
                background: "var(--cyan-soft)", color: "var(--cyan)",
                border: "1px solid var(--cyan-line)",
              }}
            ><span className="lbl">Sign up</span></Link>
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Account chip + popover ────────────────────────────────────────────────
// Click the chip → big popover floats above. Two nested sub-popovers
// (Appearance, Language) fly out to the side. Outside-click closes everything.
function AccountChip(props: {
  displayName: string;
  initials: string;
  plan: string;
  email?: string;
  isAdmin?: boolean;
  locale: "en" | "ar";
  setLocale: (l: "en" | "ar") => void;
  theme: "light" | "dark" | "system";
  setTheme: (t: "light" | "dark" | "system") => void;
  effectiveTheme: "light" | "dark";
  s: ReturnType<typeof useUI>["s"];
  onSignOut: () => void;
}) {
  const {
    displayName, initials, plan, email, isAdmin,
    locale, setLocale, theme, setTheme, effectiveTheme,
    s, onSignOut,
  } = props;

  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<null | "appearance" | "language">(null);
  const [popStyle, setPopStyle] = useState<React.CSSProperties>({});
  const [subStyle, setSubStyle] = useState<React.CSSProperties>({});
  const chipRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Position the popover above the chip, anchored to the sidebar edge.
  function position() {
    const el = chipRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const sb = document.querySelector(".sidebar")?.getBoundingClientRect();
    const dir = document.documentElement.dir || "ltr";
    const bottom = window.innerHeight - r.top + 8;
    const width = Math.max(r.width, 260);
    if (dir === "rtl") {
      setPopStyle({ position: "fixed", bottom, right: window.innerWidth - r.right, width, zIndex: 50 });
    } else {
      const left = sb ? sb.left + 12 : r.left;
      setPopStyle({ position: "fixed", bottom, left, width, zIndex: 50 });
    }
  }

  function openSub(name: "appearance" | "language" | null, e: React.MouseEvent<HTMLButtonElement>) {
    const row = e.currentTarget.getBoundingClientRect();
    const sb = document.querySelector(".sidebar")?.getBoundingClientRect();
    const dir = document.documentElement.dir || "ltr";
    if (sb) {
      if (dir === "rtl") {
        setSubStyle({ position: "fixed", top: row.top, right: window.innerWidth - sb.left + 8, zIndex: 51 });
      } else {
        setSubStyle({ position: "fixed", top: row.top, left: sb.right + 8, zIndex: 51 });
      }
    }
    setSub(name);
  }

  function toggle() {
    if (!open) {
      position();
      setOpen(true);
    } else {
      setOpen(false);
      setSub(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (
        !popRef.current?.contains(target) &&
        !chipRef.current?.contains(target) &&
        !document.querySelector(".acct-sub-pop")?.contains(target)
      ) {
        setOpen(false);
        setSub(null);
      }
    }
    function onResize() { position(); }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const themeIcon = effectiveTheme === "light" ? I.sun : I.moon;
  const themeDesc =
    theme === "system" ? `${s.themeSystem} (${effectiveTheme === "light" ? s.themeLight : s.themeDark})`
    : theme === "light" ? s.themeLight
    : s.themeDark;

  return (
    <>
      <button
        ref={chipRef}
        className="sb-account"
        type="button"
        data-active={open}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="av">{initials}</span>
        <span className="who">
          <span className="nm">{displayName}</span>
          <span className="pl">{plan} plan</span>
        </span>
        <span className="chev">{I.chevR}</span>
      </button>

      {open && (
        <div ref={popRef} className="tools-pop account-pop" style={popStyle} role="menu">
          {/* Header row — non-interactive identity card. */}
          <div className="tool-row" style={{ pointerEvents: "none" }}>
            <span
              className="av"
              style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "linear-gradient(135deg, var(--cyan), var(--purple))",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: "white", fontWeight: 700, fontSize: 13,
              }}
            >{initials}</span>
            <span className="col">
              <span className="ttl">{displayName}</span>
              <span className="desc">{email || `${plan} plan`}</span>
            </span>
          </div>
          <div className="popover-sep" />

          <button
            type="button"
            className="tool-row"
            data-active={sub === "appearance"}
            onClick={(e) => openSub(sub === "appearance" ? null : "appearance", e)}
          >
            <span className="swatch">{themeIcon}</span>
            <span className="col">
              <span className="ttl">{s.appearance}</span>
              <span className="desc">{themeDesc}</span>
            </span>
            <span className="trail-chev">{I.chevR}</span>
          </button>

          <button
            type="button"
            className="tool-row"
            data-active={sub === "language"}
            onClick={(e) => openSub(sub === "language" ? null : "language", e)}
          >
            <span className="swatch">{I.globe}</span>
            <span className="col">
              <span className="ttl">{s.language}</span>
              <span className="desc">{locale === "en" ? s.langEN : s.langAR}</span>
            </span>
            <span className="trail-chev">{I.chevR}</span>
          </button>

          <div className="popover-sep" />

          <Link href="/admin" className="tool-row" onClick={() => setOpen(false)}>
            <span className="swatch">{I.gear}</span>
            <span className="col">
              <span className="ttl">{s.settings}</span>
              <span className="desc">{s.settingsDesc}</span>
            </span>
          </Link>
          <Link href="/billing" className="tool-row" onClick={() => setOpen(false)}>
            <span className="swatch y">{I.bolt}</span>
            <span className="col">
              <span className="ttl">{s.plans}</span>
              <span className="desc">{s.plansDesc}</span>
            </span>
          </Link>
          {isAdmin && (
            <Link href="/admin" className="tool-row" onClick={() => setOpen(false)}>
              <span className="swatch p">{I.skills}</span>
              <span className="col">
                <span className="ttl">Admin</span>
                <span className="desc">Users · payments · sessions</span>
              </span>
            </Link>
          )}

          <div className="popover-sep" />

          <button
            type="button"
            className="tool-row logout"
            onClick={async () => { setOpen(false); await onSignOut(); }}
          >
            <span className="swatch p">{I.logout}</span>
            <span className="col">
              <span className="ttl">{s.logout}</span>
              <span className="desc">{s.logoutDesc}</span>
            </span>
          </button>
        </div>
      )}

      {/* Appearance flyout */}
      {open && sub === "appearance" && (
        <div className="tools-pop acct-sub-pop" style={subStyle} role="menu">
          <button type="button" className="tool-row" data-active={theme === "light"} onClick={() => setTheme("light")}>
            <span className="swatch">{I.sun}</span>
            <span className="ttl">{s.themeLight}</span>
            {theme === "light" && <span className="check-end">{I.check}</span>}
          </button>
          <button type="button" className="tool-row" data-active={theme === "dark"} onClick={() => setTheme("dark")}>
            <span className="swatch">{I.moon}</span>
            <span className="ttl">{s.themeDark}</span>
            {theme === "dark" && <span className="check-end">{I.check}</span>}
          </button>
          <button type="button" className="tool-row" data-active={theme === "system"} onClick={() => setTheme("system")}>
            <span className="swatch">{I.monitor}</span>
            <span className="ttl">{s.themeSystem}</span>
            {theme === "system" && <span className="check-end">{I.check}</span>}
          </button>
        </div>
      )}

      {/* Language flyout */}
      {open && sub === "language" && (
        <div className="tools-pop acct-sub-pop" style={subStyle} role="menu">
          <button type="button" className="tool-row" data-active={locale === "en"} onClick={() => setLocale("en")}>
            <span className="swatch"><span className="mono-tag">EN</span></span>
            <span className="ttl">{s.langEN}</span>
            {locale === "en" && <span className="check-end">{I.check}</span>}
          </button>
          <button type="button" className="tool-row" data-active={locale === "ar"} onClick={() => setLocale("ar")}>
            <span className="swatch"><span className="mono-tag">AR</span></span>
            <span className="ttl">{s.langAR}</span>
            {locale === "ar" && <span className="check-end">{I.check}</span>}
          </button>
        </div>
      )}
    </>
  );
}
