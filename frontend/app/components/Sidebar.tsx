"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { I } from "../icons";
import { useAuth } from "../lib/auth-context";
import { useUI } from "../lib/ui-context";
import { chats as chatsApi, type Chat } from "../lib/api";

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
    // Always navigate to / with a nonce param so the Dashboard effect
    // re-fires and clears chatId + messages, whether we were on /,
    // /?c=<id>, or another route. The nonce also prevents Next.js from
    // skipping the route change when we're already on /.
    router.push(`/?n=${Date.now()}`);
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
        <HistoryRow label={s.recent} />
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

// ─── History row + popover ────────────────────────────────────────────────
// Sidebar entry that, when clicked, pops out a panel listing the user's
// most-recent persisted chats. Click an item → /?c=<id> loads that
// transcript in the dashboard. Delete (×) removes the chat row from the
// list optimistically and fires DELETE in the background.
function HistoryRow({ label }: { label: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);
  const [popStyle, setPopStyle] = useState<React.CSSProperties>({});
  const [mounted, setMounted] = useState(false);
  const rowRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Refresh the list every time the popover opens — the user might have
  // started a new chat since they last looked, and a stale cache would hide
  // it.
  function loadList() {
    setLoading(true);
    chatsApi.list()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }

  function position() {
    const el = rowRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dir = document.documentElement.dir === "rtl" ? "rtl" : "ltr";
    if (dir === "rtl") {
      setPopStyle({ position: "fixed", top: r.top, right: window.innerWidth - r.left + 8, width: 320, zIndex: 50 });
    } else {
      setPopStyle({ position: "fixed", top: r.top, left: r.right + 8, width: 320, zIndex: 50 });
    }
  }

  function toggle() {
    if (!open) {
      position();
      loadList();
      setOpen(true);
    } else {
      setOpen(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (!popRef.current?.contains(target) && !rowRef.current?.contains(target)) {
        setOpen(false);
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

  async function removeChat(id: string, e: React.MouseEvent) {
    e.stopPropagation(); e.preventDefault();
    setItems((cur) => cur.filter((c) => c.id !== id));
    try { await chatsApi.remove(id); } catch { /* refetch on next open will resync */ }
  }

  return (
    <>
      <button
        ref={rowRef}
        type="button"
        className="sb-row"
        onClick={toggle}
        data-active={open}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={!user}
        style={!user ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
        title={user ? label : `${label} (sign in to see your past chats)`}
      >
        {I.history}
        <span className="lbl">{label}</span>
        <span className="trail-chev">{I.chevR}</span>
      </button>

      {open && mounted && createPortal(
        <div ref={popRef} className="tools-pop history-pop" style={popStyle} role="menu">
          <div className="pop-header">{label}</div>
          {loading ? (
            <div className="tool-row" style={{ color: "var(--muted)", justifyContent: "center" }}>
              Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="tool-row" style={{ color: "var(--muted)", justifyContent: "center" }}>
              No chats yet
            </div>
          ) : (
            items.slice(0, 40).map((c) => (
              <button
                key={c.id}
                type="button"
                className="tool-row history-item"
                onClick={() => {
                  setOpen(false);
                  router.push(`/?c=${encodeURIComponent(c.id)}`);
                }}
              >
                <span className="col">
                  <span className="ttl">{c.title || "Untitled chat"}</span>
                  <span className="desc">{new Date(c.updatedAt).toLocaleString()}</span>
                </span>
                <span
                  className="history-del"
                  role="button"
                  aria-label="Delete chat"
                  onClick={(e) => removeChat(c.id, e)}
                  title="Delete chat"
                >×</span>
              </button>
            ))
          )}
        </div>,
        document.body
      )}
    </>
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
  const [mounted, setMounted] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // createPortal needs document.body, which isn't available during SSR.
  // Render-gate the portal until after first client mount.
  useEffect(() => { setMounted(true); }, []);

  // Anchor the popover directly to the chip (not to the sidebar rect).
  // The previous version measured the sidebar and added an offset; that broke
  // when the sidebar's stacking context (backdrop-filter) confused getBCR
  // and the popover landed on the wrong side of the screen entirely.
  //
  // Both LTR and RTL: popover sits ABOVE the chip, with its near edge
  // (left in LTR, right in RTL) aligned to the chip's near edge.
  function position() {
    const el = chipRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dir = document.documentElement.dir === "rtl" ? "rtl" : "ltr";
    const bottom = window.innerHeight - r.top + 8;
    const width = Math.max(r.width, 260);
    if (dir === "rtl") {
      setPopStyle({
        position: "fixed",
        bottom,
        right: Math.max(8, window.innerWidth - r.right),
        width,
        zIndex: 50,
      });
    } else {
      setPopStyle({
        position: "fixed",
        bottom,
        left: Math.max(8, r.left),
        width,
        zIndex: 50,
      });
    }
  }

  // Sub-popover spawns from a row inside the main popover. It floats to the
  // side AWAY from the chip (so it doesn't overlap the menu the user just
  // opened) — to the right in LTR, to the left in RTL.
  function openSub(name: "appearance" | "language" | null, e: React.MouseEvent<HTMLButtonElement>) {
    const row = e.currentTarget.getBoundingClientRect();
    const pop = popRef.current?.getBoundingClientRect();
    const dir = document.documentElement.dir === "rtl" ? "rtl" : "ltr";
    const top = row.top;
    if (!pop) {
      // Should never happen — popRef is set when the main popover is mounted.
      // Fall through to using the row as the anchor.
      if (dir === "rtl") {
        setSubStyle({ position: "fixed", top, right: window.innerWidth - row.left + 8, zIndex: 51 });
      } else {
        setSubStyle({ position: "fixed", top, left: row.right + 8, zIndex: 51 });
      }
    } else if (dir === "rtl") {
      // Place sub-popover to the LEFT of the main popover.
      setSubStyle({ position: "fixed", top, right: Math.max(8, window.innerWidth - pop.left + 8), zIndex: 51 });
    } else {
      // Place sub-popover to the RIGHT of the main popover.
      setSubStyle({ position: "fixed", top, left: Math.min(window.innerWidth - 220, pop.right + 8), zIndex: 51 });
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

  // Locale picker: close the popover and force a full page reload so every
  // rendered piece of UI (composer placeholders, sidebar labels on other
  // pages, RTL/LTR-conditioned layouts, etc.) gets re-rendered against the
  // chosen language without lingering on the old strings.
  function pickLocale(l: "en" | "ar") {
    setLocale(l);
    setOpen(false);
    setSub(null);
    if (typeof window !== "undefined") {
      // Defer until after React commits the setLocale state (which writes
      // dir/lang to <html> via UIProvider's effect), so the post-reload
      // render starts from the right attributes.
      setTimeout(() => window.location.reload(), 0);
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

      {open && mounted && createPortal(
        <>
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

          <Link href="/settings" className="tool-row" onClick={() => setOpen(false)}>
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

        {/* Appearance flyout — closes the whole account menu after a pick
            so the user doesn't have to click outside. Theme change is live
            via data-theme on <html>, no reload needed. */}
        {sub === "appearance" && (
          <div className="tools-pop acct-sub-pop" style={subStyle} role="menu">
            <button type="button" className="tool-row" data-active={theme === "light"} onClick={() => { setTheme("light"); setOpen(false); setSub(null); }}>
              <span className="swatch">{I.sun}</span>
              <span className="ttl">{s.themeLight}</span>
              {theme === "light" && <span className="check-end">{I.check}</span>}
            </button>
            <button type="button" className="tool-row" data-active={theme === "dark"} onClick={() => { setTheme("dark"); setOpen(false); setSub(null); }}>
              <span className="swatch">{I.moon}</span>
              <span className="ttl">{s.themeDark}</span>
              {theme === "dark" && <span className="check-end">{I.check}</span>}
            </button>
            <button type="button" className="tool-row" data-active={theme === "system"} onClick={() => { setTheme("system"); setOpen(false); setSub(null); }}>
              <span className="swatch">{I.monitor}</span>
              <span className="ttl">{s.themeSystem}</span>
              {theme === "system" && <span className="check-end">{I.check}</span>}
            </button>
          </div>
        )}

        {/* Language flyout — closes the menu AND hard-reloads so every
            already-rendered piece of UI (server components, cached strings,
            RTL/LTR-conditioned layouts) picks up the new locale from the
            same first render. setLocale runs first so the next page load
            already starts in the new language. */}
        {sub === "language" && (
          <div className="tools-pop acct-sub-pop" style={subStyle} role="menu">
            <button type="button" className="tool-row" data-active={locale === "en"} onClick={() => pickLocale("en")}>
              <span className="swatch"><span className="mono-tag">EN</span></span>
              <span className="ttl">{s.langEN}</span>
              {locale === "en" && <span className="check-end">{I.check}</span>}
            </button>
            <button type="button" className="tool-row" data-active={locale === "ar"} onClick={() => pickLocale("ar")}>
              <span className="swatch"><span className="mono-tag">AR</span></span>
              <span className="ttl">{s.langAR}</span>
              {locale === "ar" && <span className="check-end">{I.check}</span>}
            </button>
          </div>
        )}
        </>,
        document.body
      )}
    </>
  );
}
