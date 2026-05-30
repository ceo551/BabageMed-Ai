"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { I, featureIcon } from "../../icons";
import { useUI } from "../../lib/ui-context";
import { useAuth } from "../../lib/auth-context";
import { Modal } from "../../components/Modal";
import { chats as chatsApi, type Chat } from "../../lib/api";
import type { FeatureMeta } from "../../i18n";
import { usePrefs, prefs } from "../../lib/store";

// FeatureSubSidebar — left column of the feature page, designed to read
// as "glued" to the main app sidebar. Shows the feature's name, a New
// chat button for that feature, and a chats-for-this-feature history
// list. Per-feature chats are filtered via ?feature=<slug>, which the
// general History row (?feature=general) excludes.
export function FeatureSubSidebar({ meta, panels, onMobileClose }: { meta: FeatureMeta; panels?: React.ReactNode; onMobileClose?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { user } = useAuth();
  const { s } = useUI();
  const activeChatId = params?.get("c") || "";
  // Sub-sidebar collapse + width come from the global prefs store so a
  // reload restores them, and so the parent .feat-shell-3col can read the
  // width via a CSS var (see page.tsx).
  const { subSidebarCollapsed } = usePrefs();

  const [items, setItems] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string>("");
  const [renaming, setRenaming] = useState<Chat | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  // Drag-to-resize on the inline-end edge. Mirrors the main sidebar's
  // pattern in components/Sidebar.tsx.
  const draggingRef = useRef(false);
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      // Drag handle sits at the right edge of the sub-sidebar, which is
      // itself the second column of .shell (after the main sidebar). The
      // sub-sidebar's width = clientX − sidebarLeftOffset, but reading
      // the sidebar width from the store + grid layout is messy. Use
      // the bounding rect of the aside instead.
      const el = document.querySelector(".feat-subsb") as HTMLElement | null;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ltr = document.documentElement.getAttribute("dir") !== "rtl";
      const w = ltr ? (e.clientX - rect.left) : (rect.right - e.clientX);
      prefs.setSubSidebarWidth(w);
    }
    function onUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  useEffect(() => {
    if (!user) { setItems([]); return; }
    let cancelled = false;
    setLoading(true);
    chatsApi.list(meta.slug)
      .then((list) => { if (!cancelled) setItems(list); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, pathname, params, meta.slug]);

  // Click-outside / Escape closes the overflow menu.
  useEffect(() => {
    if (!menuOpenId) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest?.(".feat-subsb-row-menu") && !t.closest?.(".feat-subsb-item-menu-btn")) {
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

  function startNewChat() {
    onMobileClose?.();
    router.push(`/features/${encodeURIComponent(meta.slug)}?n=${Date.now()}`);
  }

  async function removeChat(id: string) {
    setMenuOpenId("");
    let removed: Chat | undefined;
    setItems((cur) => {
      removed = cur.find((c) => c.id === id);
      return cur.filter((c) => c.id !== id);
    });
    try {
      await chatsApi.remove(id);
      if (id === activeChatId) router.push(`/features/${encodeURIComponent(meta.slug)}`);
    } catch {
      if (removed) {
        const r = removed;
        setItems((cur) => (cur.some((c) => c.id === r.id) ? cur : [r, ...cur]));
      }
    }
  }

  function openRename(chat: Chat) {
    setMenuOpenId("");
    setRenaming(chat);
    setRenameDraft(chat.title || "");
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
      // Leave modal open so user can retry.
    } finally {
      setSavingRename(false);
    }
  }

  return (
    <aside
      className="feat-subsb"
      aria-label={meta.label}
      data-color={meta.color}
      data-collapsed={subSidebarCollapsed}
    >
      <header className="feat-subsb-head">
        <span className="feat-subsb-emoji" aria-hidden="true">{featureIcon(meta.slug, meta.emoji)}</span>
        <div className="feat-subsb-title">
          <span className="t">{meta.label}</span>
          <span className="sub">{s.workspace}</span>
        </div>
        <button
          type="button"
          className="feat-subsb-collapse"
          onClick={prefs.toggleSubSidebar}
          aria-label={subSidebarCollapsed ? s.expandSidebar : s.collapseSidebar}
          title={subSidebarCollapsed ? s.expandSidebar : s.collapseSidebar}
        >
          {I.sidebar}
        </button>
      </header>

      <button className="feat-subsb-new" type="button" onClick={startNewChat} title={s.new}>
        {I.plus}
        <span className="feat-subsb-new-lbl">{s.new}</span>
      </button>

      {/* Feature-config panels (Instructions / Files / Skills) sit right
          beneath the New-chat button so configuration affordances are
          above the per-feature chat history — the panels are the
          "what" of this feature; the history is the past usage. */}
      {panels && !subSidebarCollapsed && (
        <div className="feat-subsb-panels">{panels}</div>
      )}

      <div className="feat-subsb-section-label">{s.recent}</div>
      {!user ? (
        <div className="feat-subsb-empty">{s.signInToKeepHistory}</div>
      ) : loading && items.length === 0 ? (
        <div className="feat-subsb-empty">{s.loadingChats}</div>
      ) : items.length === 0 ? (
        <div className="feat-subsb-empty">{s.noChatsYet}</div>
      ) : (
        <ul className="feat-subsb-list">
          {items.slice(0, 50).map((c) => (
            <li key={c.id} className="feat-subsb-li">
              <button
                type="button"
                className="feat-subsb-item"
                data-active={c.id === activeChatId}
                onClick={() => { onMobileClose?.(); router.push(`/features/${encodeURIComponent(meta.slug)}?c=${encodeURIComponent(c.id)}`); }}
                title={c.title || s.untitledChat}
              >
                <span className="feat-subsb-item-icon" aria-hidden="true">{I.chatBubble}</span>
                <span className="feat-subsb-item-title">{c.title || s.untitledChat}</span>
              </button>
              <button
                type="button"
                className="feat-subsb-item-menu-btn"
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
                  className="feat-subsb-row-menu"
                  role="menu"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="feat-subsb-row-menu-item"
                    onClick={() => openRename(c)}
                  >
                    {I.edit}
                    <span>{s.rename}</span>
                  </button>
                  <button
                    type="button"
                    className="feat-subsb-row-menu-item is-danger"
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

      {/* Drag-to-resize handle pinned to the inline-end edge. CSS hides
          this on collapsed/mobile so it can't be grabbed accidentally. */}
      <div
        className="feat-subsb-resize"
        role="separator"
        aria-orientation="vertical"
        aria-label={s.resizeSubSidebar}
        onMouseDown={(e) => {
          e.preventDefault();
          draggingRef.current = true;
          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";
        }}
      />

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
    </aside>
  );
}
