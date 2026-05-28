"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { I, featureIcon } from "../icons";
import { useAuth } from "../lib/auth-context";
import { useUI } from "../lib/ui-context";
import { chats as chatsApi, type Chat } from "../lib/api";
import type { FeatureMeta } from "../i18n";
import { Modal } from "./Modal";

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
export function Sidebar({
  onResize,
  onMobileClose,
}: {
  onResize?: (px: number) => void;
  onMobileClose?: () => void;
} = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { locale, setLocale, theme, setTheme, effectiveTheme, toggleCollapsed, s } = useUI();
  // Drag-to-resize: while a pointer is active on the handle we listen
  // for window-level move/up events. Width is updated through the
  // parent's onResize so it persists via the prefs store.
  //
  // Round 26: Switched from MouseEvent to PointerEvent so pen / touch
  // / stylus users on tablets can drag too. Also snapshot the document
  // dir at drag-start instead of reading it on every pointermove —
  // dir doesn't change mid-drag.
  const draggingRef = useRef(false);
  const ltrRef = useRef(true);
  useEffect(() => {
    if (!onResize) return;
    const resize = onResize;
    function onMove(e: PointerEvent) {
      if (!draggingRef.current) return;
      const x = ltrRef.current ? e.clientX : (window.innerWidth - e.clientX);
      resize(x);
    }
    function onUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [onResize]);

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
    <aside className="sidebar" aria-label={s.sidebarLabel}>
      <div className="sb-head">
        <Link className="sb-brand" href="/" onClick={() => onMobileClose?.()}>
          {I.discLogo}
          <span className="wm">
            <span className="b1">Babbage</span>
          </span>
        </Link>
        <button className="sb-collapse" onClick={toggleCollapsed} aria-label={s.collapseSidebar}>
          {I.sidebar}
        </button>
      </div>
      {/* Drag-to-resize handle pinned to the inline-end edge of the
          sidebar. Becomes invisible at mobile breakpoints (CSS hides
          it). tabIndex=0 + arrow-key handler satisfies ARIA APG
          separator pattern so keyboard users can resize too. */}
      {onResize && (
        <div
          className="sidebar-resize"
          role="separator"
          aria-orientation="vertical"
          aria-label={s.resizeSidebar}
          tabIndex={0}
          onPointerDown={(e) => {
            e.preventDefault();
            // Snapshot dir once per drag (doesn't change mid-drag) so
            // we don't re-read documentElement.getAttribute on every
            // 60-120 Hz pointermove.
            ltrRef.current = document.documentElement.getAttribute("dir") !== "rtl";
            draggingRef.current = true;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
          }}
          onKeyDown={(e) => {
            // Arrow keys nudge the sidebar 8 px per press; Shift+arrow
            // jumps 32 px for fast adjustment. Matches the resize step
            // common in DAW-style UIs. Width derives from the current
            // sidebar offsetWidth so the keyboard interaction is
            // independent of pointer state.
            const sb = (e.currentTarget.parentElement as HTMLElement | null);
            if (!sb) return;
            const ltr = document.documentElement.getAttribute("dir") !== "rtl";
            const step = e.shiftKey ? 32 : 8;
            const sign = (e.key === (ltr ? "ArrowRight" : "ArrowLeft")) ? 1
              : (e.key === (ltr ? "ArrowLeft" : "ArrowRight")) ? -1
              : 0;
            if (sign === 0) return;
            e.preventDefault();
            const next = sb.offsetWidth + sign * step;
            onResize(next);
          }}
        />
      )}

      <div className="sb-body">
        <button className="sb-new" type="button" title={s.new} onClick={startNewChat}>
          {I.plus}
          <span className="lbl">{s.new}</span>
          <span className="kbd">⌘ K</span>
        </button>

        {/* Features — fixed 10-category nav. Order matches the mockup:
            10 feature rows → Connectors row → general History.
            Per-feature chat history lives on each feature's sub-sidebar,
            not here. */}
        <FeaturesSection
          label={s.featuresHeader}
          items={s.features}
          activeSlug={featureSlugFromPath(pathname)}
        />

        <Link
          href="/mcps"
          className="sb-row"
          data-active={pathname === "/mcps"}
          style={{ textDecoration: "none" }}
        >
          {I.connectors}
          <span className="lbl">{s.connectors}</span>
          <span className="trail-chev">{I.chevR}</span>
        </Link>

        <HistorySection label={s.recent} feature="general" />
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
            ><span className="lbl">{s.signInCta}</span></Link>
            <Link
              href="/signup"
              className="sb-row"
              style={{
                flex: 1, justifyContent: "center", textDecoration: "none",
                background: "var(--cyan-soft)", color: "var(--cyan)",
                border: "1px solid var(--cyan-line)",
              }}
            ><span className="lbl">{s.signUpCta}</span></Link>
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Features section ─────────────────────────────────────────────────────
// Renders one row per fixed feature category. The 10 categories are:
// Healthcare, Education, Writing, Translation, Data Analysis, Business,
// Financial Services, Consulting, Image & Video, Advertisements. Active
// row is highlighted via data-active so the user always knows which
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
              // aria-label so collapsed-mode (icons only) stays
              // announceable for screen readers; the visible label is
              // hidden via display:none in that mode.
              aria-label={f.label}
            >
              <span className="sb-feature-emoji" aria-hidden="true">{featureIcon(f.slug, f.emoji)}</span>
              <span className="sb-feature-label">{f.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── History section (inline, Claude-style) ───────────────────────────────
// Inline beneath the primary nav rows; each row prefixed with a chat icon
// and a 3-dot overflow menu (Rename / Delete) so the affordances match the
// feature-page sub-sidebar (see FeatureSubSidebar.tsx).
function HistorySection({ label, feature }: { label: string; feature?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { s } = useUI();
  const [items, setItems] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string>("");
  const [renaming, setRenaming] = useState<Chat | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [savingRename, setSavingRename] = useState(false);

  // Read the current chat id from the URL search params. Using the
  // useSearchParams() hook (instead of window.location) means we also
  // pick up history.replaceState() updates — the chat-stream code stamps
  // ?c=<id> via replaceState so the URL never re-renders the route,
  // but the param hook still observes the change. Closes the bug where
  // a fresh chat created from the home composer never highlighted the
  // active row in the sidebar history list.
  const searchParams = useSearchParams();
  const activeChatId = searchParams?.get("c") || "";

  // Refetch on mount and whenever the URL pathname changes (so creating a
  // new chat or switching tabs surfaces the latest titles). Skip the call
  // entirely for anonymous users — /api/chats requires auth.
  //
  // Round 27: pathname stays the same when the chat-stream code does
  // `history.replaceState` to stamp `?c=<id>` on the URL (no real
  // navigation), so the just-created chat's title was missing from the
  // sidebar list until the next real route push. Also listen for a
  // custom "babbage:chat-created" window event the streamer dispatches
  // after the URL replacement, so the new chat surfaces immediately.
  useEffect(() => {
    if (!user) { setItems([]); return; }
    let cancelled = false;
    const refetch = () => {
      setLoading(true);
      chatsApi.list(feature)
        .then((list) => { if (!cancelled) setItems(list); })
        .catch(() => { if (!cancelled) setItems([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    refetch();
    const onChatCreated = () => refetch();
    if (typeof window !== "undefined") {
      window.addEventListener("babbage:chat-created", onChatCreated);
    }
    return () => {
      cancelled = true;
      if (typeof window !== "undefined") {
        window.removeEventListener("babbage:chat-created", onChatCreated);
      }
    };
  }, [user, pathname, feature]);

  // Close the overflow menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpenId) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest?.(".sb-history-row-menu") && !t.closest?.(".sb-history-menu-btn")) {
        setMenuOpenId("");
      }
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setMenuOpenId(""); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpenId]);

  async function removeChat(id: string) {
    setMenuOpenId("");
    // Capture both the row AND its original index so a failed delete
    // can put the row back where the user dragged-or-typed it to,
    // not at the top of the list. The previous version prepended on
    // rollback, which silently re-ordered the user's chat history.
    let removed: Chat | undefined;
    let removedIdx = -1;
    setItems((cur) => {
      removedIdx = cur.findIndex((c) => c.id === id);
      removed = removedIdx >= 0 ? cur[removedIdx] : undefined;
      return cur.filter((c) => c.id !== id);
    });
    try {
      await chatsApi.remove(id);
      if (id === activeChatId) router.push("/");
    } catch {
      if (removed) {
        const r = removed;
        const idx = removedIdx;
        setItems((cur) => {
          if (cur.some((c) => c.id === r.id)) return cur;
          const next = cur.slice();
          // clamp index in case the list shrunk further while we
          // were awaiting the failed network call.
          next.splice(Math.min(idx, next.length), 0, r);
          return next;
        });
      }
    }
  }

  function openRename(c: Chat) {
    setMenuOpenId("");
    setRenaming(c);
    setRenameDraft(c.title || "");
  }
  async function submitRename() {
    if (!renaming) return;
    const title = renameDraft.trim();
    if (!title || title === renaming.title) { setRenaming(null); return; }
    setSavingRename(true);
    const id = renaming.id;
    try {
      const updated = await chatsApi.rename(id, title);
      setItems((cur) => cur.map((c) => (c.id === id ? { ...c, title: updated.title } : c)));
      setRenaming(null);
    } catch {
      // Leave the modal open so the user can retry.
    } finally {
      setSavingRename(false);
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
        <div className="sb-history-empty">{s.loadingChats}</div>
      ) : items.length === 0 ? (
        <div className="sb-history-empty">{s.noChatsYet}</div>
      ) : (
        <ul className="sb-history-list">
          {items.slice(0, 40).map((c) => (
            <li key={c.id} className="sb-history-li">
              <button
                type="button"
                className="sb-history-item"
                data-active={c.id === activeChatId}
                onClick={() => router.push(`/?c=${encodeURIComponent(c.id)}`)}
                title={c.title || s.untitledChat}
              >
                <span className="sb-history-icon" aria-hidden="true">{I.chatBubble}</span>
                <span className="sb-history-title">{c.title || s.untitledChat}</span>
              </button>
              <button
                type="button"
                className="sb-history-menu-btn"
                aria-label={s.chatOptions}
                title={s.more}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId((cur) => (cur === c.id ? "" : c.id));
                }}
              >
                {I.dotsV}
              </button>
              {menuOpenId === c.id && (
                <div
                  className="sb-history-row-menu"
                  role="menu"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="sb-history-row-menu-item"
                    onClick={() => openRename(c)}
                  >
                    {I.edit}
                    <span>{s.rename}</span>
                  </button>
                  <button
                    type="button"
                    className="sb-history-row-menu-item is-danger"
                    onClick={() => removeChat(c.id)}
                  >
                    {I.trash}
                    <span>{s.delete}</span>
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        title={s.renameChat}
        width={420}
      >
        <input
          type="text"
          className="feat-modal-input"
          placeholder={s.chatTitle}
          value={renameDraft}
          onChange={(e) => setRenameDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitRename(); } }}
          autoFocus
        />
        <div className="feat-modal-foot">
          <button
            type="button"
            className="feat-btn-secondary"
            onClick={() => setRenaming(null)}
            disabled={savingRename}
          >{s.cancel}</button>
          <button
            type="button"
            className="feat-btn-primary"
            onClick={submitRename}
            disabled={savingRename || !renameDraft.trim()}
          >{savingRename ? s.saving : s.save}</button>
        </div>
      </Modal>
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
