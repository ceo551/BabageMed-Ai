"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { I } from "../icons";
import { useAuth } from "../lib/auth-context";
import { useUI } from "../lib/ui-context";
import { chats as chatsApi, type Chat } from "../lib/api";
import type { FeatureMeta } from "../i18n";

// Pull the feature slug out of the current pathname so the matching sidebar
// row gets the active treatment. Returns "" outside the /features/* routes.
function featureSlugFromPath(p: string | null): string {
  if (!p) return "";
  const m = p.match(/^\/features\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

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
            <span className="b1">Bab</span>
            <span className="b2">bage</span>
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

        {/* Features — fixed 8-category nav. Replaces the legacy "Spaces" link
            with one explicit row per feature so the active item is visible
            at a glance and there's no extra dropdown to discover. */}
        <FeaturesSection
          label={s.featuresHeader}
          items={s.features}
          activeSlug={featureSlugFromPath(pathname)}
        />

        <HistorySection label={s.recent} />

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

// ─── Features section ─────────────────────────────────────────────────────
// Renders one row per fixed feature category (Healthcare, Writing,
// Translation, Business, Financial, Consulting, Math & Science, Education).
// Active row is highlighted via data-active so the user always knows which
// workflow's context (instructions/files/skills/connectors) is in use.
function FeaturesSection({
  label,
  items,
  activeSlug,
}: {
  label: string;
  items: ReadonlyArray<FeatureMeta>;
  activeSlug: string;
}) {
  return (
    <div className="sb-features">
      <div className="sb-section-label">{label}</div>
      <ul className="sb-features-list">
        {items.map((f) => (
          <li key={f.slug}>
            <Link
              href={`/features/${f.slug}`}
              className="sb-feature-item"
              data-active={f.slug === activeSlug}
              data-color={f.color}
              title={f.label}
            >
              <span className="sb-feature-emoji" aria-hidden="true">{f.emoji}</span>
              <span className="sb-feature-label">{f.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── History section (inline, Claude-style) ───────────────────────────────
// Previously this was a sidebar row that opened a portalled flyout to the
// right — visually busy and out of step with how Claude/Gemini present
// recent chats. Now it renders inline beneath the primary nav rows as a
// scrollable list of the user's most-recent chats. Click → /?c=<id> loads
// that transcript. The list refetches whenever the URL changes (a new
// chat send pushes ?c=<NEW_ID> which triggers the refetch), and the
// currently-loaded chat is highlighted via data-active.
function HistorySection({ label }: { label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [items, setItems] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);

  // Read the current chat id from the URL search part. usePathname() doesn't
  // include the query string, but it does fire on full URL changes so we
  // re-derive activeChatId from window.location each render once mounted.
  const [activeChatId, setActiveChatId] = useState<string>("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    setActiveChatId(u.searchParams.get("c") || "");
  }, [pathname]);

  // Refetch on mount and whenever the URL pathname changes (so creating a
  // new chat or switching tabs surfaces the latest titles). Skip the call
  // entirely for anonymous users — /api/chats requires auth.
  useEffect(() => {
    if (!user) { setItems([]); return; }
    let cancelled = false;
    setLoading(true);
    chatsApi.list()
      .then((list) => { if (!cancelled) setItems(list); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, pathname]);

  async function removeChat(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    // Snapshot the row so we can put it back if the DELETE fails — the
    // previous "next navigation will resync" comment was wrong because
    // pathname doesn't change for in-place deletes, leaving the user
    // believing a chat was deleted when it wasn't.
    let removed: Chat | undefined;
    setItems((cur) => {
      removed = cur.find((c) => c.id === id);
      return cur.filter((c) => c.id !== id);
    });
    try {
      await chatsApi.remove(id);
      // If the active chat was just removed, drop the URL pointer so the
      // dashboard resets to the greeting instead of trying to load a 404.
      if (id === activeChatId) router.push("/");
    } catch {
      // Rollback — re-insert at its original position (top-of-list).
      if (removed) {
        const r = removed;
        setItems((cur) => (cur.some((c) => c.id === r.id) ? cur : [r, ...cur]));
      }
    }
  }

  if (!user) {
    return (
      <div className="sb-row" style={{ opacity: 0.6, cursor: "not-allowed" }}>
        {I.history}
        <span className="lbl">{label}</span>
      </div>
    );
  }

  return (
    <div className="sb-history">
      <div className="sb-section-label">{label}</div>
      {loading && items.length === 0 ? (
        <div className="sb-history-empty">Loading…</div>
      ) : items.length === 0 ? (
        <div className="sb-history-empty">No chats yet</div>
      ) : (
        <ul className="sb-history-list">
          {items.slice(0, 40).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="sb-history-item"
                data-active={c.id === activeChatId}
                onClick={() => router.push(`/?c=${encodeURIComponent(c.id)}`)}
                title={c.title || "Untitled chat"}
              >
                <span className="sb-history-title">{c.title || "Untitled chat"}</span>
                <span
                  className="sb-history-del"
                  role="button"
                  aria-label="Delete chat"
                  onClick={(e) => removeChat(c.id, e)}
                  title="Delete chat"
                >×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
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
