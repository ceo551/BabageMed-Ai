"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { useUI } from "../lib/ui-context";
import { useAuth } from "../lib/auth-context";
import { spaces as spacesApi, type Space } from "../lib/api";
import { I } from "../icons";
import { CreateSpaceModal } from "./CreateSpaceModal";
import { Modal } from "../components/Modal";
import { relativeTime } from "./relative-time";
import "./spaces.css";

// Spaces INDEX — the "Projects" screen (Claude Projects / Perplexity Spaces).
// A header (title + New space), a client-side search filter, and a responsive
// grid of space cards. Empty + auth-gated states mirror the rest of the app.
export default function SpacesIndexPage() {
  const router = useRouter();
  const { s, locale } = useUI();
  const { user, loading: authLoading } = useAuth();

  const [items, setItems] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState("");
  const [renaming, setRenaming] = useState<Space | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [savingRename, setSavingRename] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setItems([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    spacesApi.list()
      .then((list) => { if (!cancelled) setItems(list); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authLoading, user]);

  // Refetch when the tab regains focus so a space deleted elsewhere (another
  // tab, or this space's own detail page) doesn't linger as a stale "ghost"
  // card that 404s on click. Silent — no full-screen spinner toggle.
  useEffect(() => {
    if (!user) return;
    function onFocus() {
      spacesApi.list().then(setItems).catch(() => { /* keep current list */ });
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (sp) =>
        sp.name.toLowerCase().includes(q) ||
        (sp.description || "").toLowerCase().includes(q),
    );
  }, [items, query]);

  async function handleCreate(name: string, icon: string) {
    const created = await spacesApi.create({ name, icon });
    router.push(`/spaces/${encodeURIComponent(created.id)}`);
  }

  // Close the open card menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpenId) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest?.(".sp-card-menu") && !t.closest?.(".sp-card-menu-btn")) setMenuOpenId("");
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setMenuOpenId(""); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpenId]);

  async function removeSpace(id: string) {
    setMenuOpenId("");
    if (typeof window !== "undefined" && !window.confirm(s.deleteSpaceConfirm)) return;
    // Capture the removed row + its index so a failed delete re-inserts only
    // that row at its original position (not a stale whole-list snapshot that
    // would clobber any concurrent rename/delete).
    let removed: Space | undefined;
    let at = -1;
    setItems((cur) => {
      at = cur.findIndex((sp) => sp.id === id);
      removed = at >= 0 ? cur[at] : undefined;
      return cur.filter((sp) => sp.id !== id);
    });
    try { await spacesApi.remove(id); }
    catch {
      if (removed) {
        const r = removed, idx = at;
        setItems((cur) => {
          if (cur.some((sp) => sp.id === r.id)) return cur;
          const n = cur.slice();
          n.splice(Math.min(idx, n.length), 0, r);
          return n;
        });
      }
    }
  }
  function openRename(sp: Space) { setMenuOpenId(""); setRenaming(sp); setRenameDraft(sp.name); }
  async function submitRename() {
    if (!renaming) return;
    const name = renameDraft.trim();
    if (!name || name === renaming.name) { setRenaming(null); return; }
    setSavingRename(true);
    const id = renaming.id;
    try {
      const updated = await spacesApi.update(id, { name });
      setItems((cur) => cur.map((sp) => (sp.id === id ? { ...sp, ...updated } : sp)));
      setRenaming(null);
    } catch { /* keep the dialog open to retry */ }
    finally { setSavingRename(false); }
  }

  if (authLoading) {
    return <div className="sp-loading"><span className="ps-spinner" />{s.loadingChats}</div>;
  }
  if (!user) {
    return (
      <div className="sp-gate">
        <h1>{s.spacesHeader}</h1>
        <p>
          {locale === "ar"
            ? "سجّل الدخول لاستخدام المساحات وإدارة تعليماتها وملفاتها ومهاراتها."
            : "Sign in to use spaces and customise their instructions, files and skills."}
        </p>
      </div>
    );
  }

  return (
    <div className="spaces-index">
      <div className="spaces-top">
        <div>
          <h1 className="spaces-header">{s.spacesHeader}</h1>
        </div>
        <button type="button" className="sp-new-btn" onClick={() => setCreating(true)}>
          {I.plus}
          <span>{s.newSpace}</span>
        </button>
      </div>

      <div className="sp-search-wrap">
        <span className="sp-search-ico" aria-hidden="true">{I.search}</span>
        <input
          type="search"
          className="sp-search"
          placeholder={s.searchSpaces}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={s.searchSpaces}
        />
      </div>

      {loading ? (
        <div className="sp-loading"><span className="ps-spinner" />{s.loadingChats}</div>
      ) : items.length === 0 ? (
        <div className="sp-empty">
          <span className="sp-empty-emoji" aria-hidden="true">{I.spaces}</span>
          <span className="sp-empty-title">{s.noSpacesYet}</span>
          <button type="button" className="sp-new-btn" onClick={() => setCreating(true)}>
            {I.plus}
            <span>{s.newSpace}</span>
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="sp-empty">
          <span className="sp-empty-emoji" aria-hidden="true">🔍</span>
          <span className="sp-empty-title">{s.noSpacesMatch}</span>
          <button type="button" className="sp-new-btn" onClick={() => setQuery("")}>{s.clearSearch}</button>
        </div>
      ) : (
        <div className="sp-grid">
          {filtered.map((sp) => (
            <Link
              key={sp.id}
              href={`/spaces/${encodeURIComponent(sp.id)}`}
              className="sp-card"
            >
              <button
                type="button"
                className="sp-card-menu-btn"
                data-open={menuOpenId === sp.id}
                aria-label={s.more}
                title={s.more}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuOpenId((cur) => (cur === sp.id ? "" : sp.id));
                }}
              >
                {I.dotsV}
              </button>
              {menuOpenId === sp.id && (
                <div className="sp-card-menu" role="menu" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                  <button type="button" className="sp-card-menu-item" onClick={(e) => { e.preventDefault(); openRename(sp); }}>
                    {I.edit}<span>{s.rename}</span>
                  </button>
                  <button type="button" className="sp-card-menu-item is-danger" onClick={(e) => { e.preventDefault(); removeSpace(sp.id); }}>
                    {I.trash}<span>{s.delete}</span>
                  </button>
                </div>
              )}
              <div className="sp-card-top">
                <span className="sp-card-emoji" aria-hidden="true">{sp.icon || "📁"}</span>
                <span className="sp-card-name" title={sp.name}>{sp.name}</span>
              </div>
              {sp.description ? <p className="sp-card-desc">{sp.description}</p> : null}
              <div className="sp-card-foot">
                {s.updatedAgo} {relativeTime(sp.updatedAt, locale)}
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateSpaceModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={handleCreate}
      />

      <Modal open={renaming !== null} onClose={() => setRenaming(null)} title={s.rename} width={420}>
        <input
          type="text"
          className="feat-modal-input"
          placeholder={s.spaceNameLabel}
          value={renameDraft}
          onChange={(e) => setRenameDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitRename(); } }}
          autoFocus
        />
        <div className="feat-modal-foot">
          <button type="button" className="feat-btn-secondary" onClick={() => setRenaming(null)} disabled={savingRename}>{s.cancel}</button>
          <button type="button" className="feat-btn-primary" onClick={submitRename} disabled={savingRename || !renameDraft.trim()}>{savingRename ? s.saving : s.save}</button>
        </div>
      </Modal>
    </div>
  );
}
