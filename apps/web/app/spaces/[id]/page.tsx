"use client";

import { useParams } from "next/navigation";
import React, { Suspense, useEffect, useRef, useState } from "react";
import { useUI } from "../../lib/ui-context";
import { useAuth } from "../../lib/auth-context";
import { usePrefs, prefs } from "../../lib/store";
import { spaces as spacesApi, type Space, type SpaceFile } from "../../lib/api";
import { I } from "../../icons";
import { Modal } from "../../components/Modal";
import { SpaceChat } from "./SpaceChat";
import "../../features/[slug]/feature.css";

// Per-space workspace page — adapted from features/[slug]/page.tsx.
//
//   ┌─────────────────────────────┬──────────────────────────────────┐
//   │ sub-sidebar                 │ composer + transcript            │
//   │ • space name (emoji)        │ • central prompt box             │
//   │ • Instructions / Files /    │ • chat grounded on this space's  │
//   │   Skills pill rows          │   instructions + retrieved files │
//   └─────────────────────────────┴──────────────────────────────────┘
export default function SpacePage() {
  return (
    <Suspense fallback={<div className="feat-shell"><p className="lead">Loading…</p></div>}>
      <SpacePageInner />
    </Suspense>
  );
}

function SpacePageInner() {
  const { id } = useParams<{ id: string }>();
  const { s, locale } = useUI();
  const { user, loading: authLoading } = useAuth();
  const { subSidebarWidth, subSidebarCollapsed } = usePrefs();

  const [space, setSpace] = useState<Space | null>(null);
  const [files, setFiles] = useState<SpaceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  // Mobile-only drawer state for the sub-sidebar — mirrors the feature page.
  const [subDrawerOpen, setSubDrawerOpen] = useState(false);
  useEffect(() => { setSubDrawerOpen(false); }, [id]);
  useEffect(() => {
    if (!subDrawerOpen) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setSubDrawerOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [subDrawerOpen]);

  // Fetch the space + its files. 404 / empty → friendly message.
  useEffect(() => {
    if (authLoading) return;
    if (!user || !id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotFound(false);
    spacesApi.get(id)
      .then((sp) => {
        if (cancelled) return;
        setSpace(sp);
        return spacesApi.files(id)
          .then((fl) => { if (!cancelled) setFiles(fl); })
          .catch(() => { if (!cancelled) setFiles([]); });
      })
      .catch((e) => {
        if (cancelled) return;
        if (e?.status === 404) setNotFound(true);
        else setError(e?.error || String(e));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authLoading, user, id]);

  async function refreshFiles() {
    try { setFiles(await spacesApi.files(id)); } catch { /* keep current */ }
  }

  if (authLoading) return <div className="feat-shell"><p className="lead">Loading…</p></div>;
  if (!user) {
    return (
      <div className="feat-shell">
        <h1>{s.spacesHeader}</h1>
        <p className="lead">
          {locale === "ar"
            ? "سجّل الدخول لاستخدام المساحات وإدارة تعليماتها وملفاتها ومهاراتها."
            : "Sign in to use spaces and customise their instructions, files and skills."}
        </p>
      </div>
    );
  }
  if (notFound) {
    return (
      <div className="feat-shell">
        <h1>{s.spacesHeader}</h1>
        <p className="lead">{s.noSpacesYet}</p>
      </div>
    );
  }
  if (loading && !space) return <div className="feat-shell"><p className="lead">Loading…</p></div>;
  if (!space) {
    return (
      <div className="feat-shell">
        {error && <div className="feat-err">{error}</div>}
        <p className="lead">{s.noSpacesYet}</p>
      </div>
    );
  }

  // Compact pill-style config rows — same shapes as the feature page, wired
  // to the spaces API.
  const panels = (
    <>
      <InstructionsRow
        loading={loading}
        value={space.instructions || ""}
        onSave={async (v) => {
          const updated = await spacesApi.update(id, { instructions: v });
          setSpace(updated);
        }}
      />
      <FilesRow
        loading={loading}
        files={files}
        onUpload={async (fl) => {
          // Backend upload takes ONE file — loop over the FileList.
          for (const f of Array.from(fl)) {
            await spacesApi.upload(id, f);
          }
          await refreshFiles();
        }}
        onRemove={async (fileId) => {
          await spacesApi.removeFile(id, fileId);
          await refreshFiles();
        }}
      />
      <SkillsRow
        loading={loading}
        selected={space.skills || []}
        onChange={async (skills) => {
          const updated = await spacesApi.update(id, { skills });
          setSpace(updated);
        }}
      />
    </>
  );

  return (
    <div
      className="feat-shell feat-shell-2col"
      data-color="cyan"
      data-subsb-collapsed={subSidebarCollapsed}
      data-subsb-mobile-open={subDrawerOpen}
      style={{
        "--subsb-w": `${subSidebarCollapsed ? 56 : subSidebarWidth}px`,
      } as React.CSSProperties}
    >
      {/* Mobile-only second hamburger — opens this space's sub-sidebar. */}
      <button
        type="button"
        className="feat-mobile-subsb-btn"
        aria-label={space.name}
        aria-expanded={subDrawerOpen}
        onClick={() => setSubDrawerOpen((v) => !v)}
      >
        <span aria-hidden="true">{space.icon || "🗂"}</span>
      </button>

      <SpaceSubSidebar space={space} panels={panels} />

      {/* Tap-to-close backdrop for the sub-sidebar drawer. */}
      <div
        className="feat-subsb-backdrop"
        onClick={() => setSubDrawerOpen(false)}
        aria-hidden="true"
      />

      <section className="feat-main">
        {error && <div className="feat-err">{error}</div>}
        <SpaceChat space={space} />
      </section>
    </div>
  );
}

// ─── Sub-sidebar (inline rail) ─────────────────────────────────────────────
// A trimmed version of FeatureSubSidebar: space name + the config panels.
// No per-space chat-history list (spaces share the general history), so the
// rail is just the header + panels.
function SpaceSubSidebar({ space, panels }: { space: Space; panels: React.ReactNode }) {
  const { s } = useUI();
  const { subSidebarCollapsed } = usePrefs();
  return (
    <aside
      className="feat-subsb"
      aria-label={space.name}
      data-color="cyan"
      data-collapsed={subSidebarCollapsed}
    >
      <header className="feat-subsb-head">
        <span className="feat-subsb-emoji" aria-hidden="true">{space.icon || "🗂"}</span>
        <div className="feat-subsb-title">
          <span className="t">{space.name}</span>
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

      {panels && !subSidebarCollapsed && (
        <div className="feat-subsb-panels">{panels}</div>
      )}
    </aside>
  );
}

// ─── Instructions row ─────────────────────────────────────────────────────
function InstructionsRow({
  loading,
  value,
  onSave,
}: {
  loading: boolean;
  value: string;
  onSave: (v: string) => Promise<void>;
}) {
  const { s } = useUI();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(value); }, [value]);

  async function onSubmit() {
    setSaving(true);
    try { await onSave(draft); setOpen(false); }
    finally { setSaving(false); }
  }

  return (
    <>
      <div className="feat-subsb-row" data-disabled={loading}>
        <button
          type="button"
          className="feat-subsb-row-label"
          onClick={() => { setDraft(value); setOpen(true); }}
          disabled={loading}
        >
          {s.instructions}
        </button>
        <button
          type="button"
          className="feat-subsb-row-add"
          onClick={() => { setDraft(value); setOpen(true); }}
          disabled={loading}
          aria-label={s.instructions}
          title={s.instructions}
        >
          {I.plus}
        </button>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={s.instructions}
        width={620}
      >
        <textarea
          className="feat-instr-input feat-instr-input-modal"
          placeholder={s.instructionsDesc}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={10}
          autoFocus
        />
        <div className="feat-modal-foot">
          <button
            type="button"
            className="feat-btn-secondary"
            onClick={() => setOpen(false)}
            disabled={saving}
          >{s.cancel}</button>
          <button
            type="button"
            className="feat-btn-primary"
            onClick={onSubmit}
            disabled={saving}
          >{saving ? s.saving : s.saveInstructions}</button>
        </div>
      </Modal>
    </>
  );
}

// ─── Files row ────────────────────────────────────────────────────────────
function FilesRow({
  loading,
  files,
  onUpload,
  onRemove,
}: {
  loading: boolean;
  files: SpaceFile[];
  onUpload: (fl: FileList) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const { s } = useUI();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const fl = e.target.files;
    if (!fl || fl.length === 0) return;
    setBusy(true);
    try { await onUpload(fl); } finally { setBusy(false); }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <>
      <button
        type="button"
        className="feat-subsb-row feat-subsb-row-button"
        onClick={() => setOpen(true)}
        disabled={loading}
      >
        <span className="feat-subsb-row-icon" aria-hidden="true">{I.folder}</span>
        <span className="feat-subsb-row-label as-text">{s.filesFolders}</span>
        {files.length > 0 && <span className="feat-subsb-row-count">{files.length}</span>}
        <span className="feat-subsb-row-chev" aria-hidden="true">{I.chevR}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept=".pdf,.txt,.md,.csv,.json,.docx,.html"
        onChange={onFiles}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={s.filesFolders}
        width={520}
      >
        {files.length === 0 ? (
          <div className="feat-card-empty">{s.filesFoldersDesc}</div>
        ) : (
          <ul className="feat-files feat-files-modal">
            {files.map((f) => (
              <li key={f.id} className="feat-file-row">
                <span className="feat-file-icon">{I.folder}</span>
                <span className="feat-file-name" title={f.name}>{f.name}</span>
                <span className="feat-file-size">{prettyBytes(f.sizeBytes)}</span>
                <button
                  type="button"
                  className="feat-file-del"
                  onClick={() => onRemove(f.id)}
                  aria-label={s.remove}
                  title={s.remove}
                >×</button>
              </li>
            ))}
          </ul>
        )}
        <div className="feat-modal-foot">
          <button
            type="button"
            className="feat-btn-secondary"
            onClick={() => setOpen(false)}
          >{s.cancel}</button>
          <button
            type="button"
            className="feat-btn-primary"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >{busy ? s.saving : s.addFile}</button>
        </div>
      </Modal>
    </>
  );
}

// ─── Skills row ───────────────────────────────────────────────────────────
function SkillsRow({
  loading,
  selected,
  onChange,
}: {
  loading: boolean;
  selected: string[];
  onChange: (s: string[]) => Promise<void>;
}) {
  const { s } = useUI();
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<string[]>(selected);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setLocal(selected); }, [selected]);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const fl = e.target.files;
    if (!fl || fl.length === 0) return;
    setBusy(true);
    try {
      const names = Array.from(fl).map((f) => f.name);
      const merged = Array.from(new Set([...local, ...names]));
      await onChange(merged);
      setLocal(merged);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(name: string) {
    const next = local.filter((x) => x !== name);
    setLocal(next);
    try { await onChange(next); }
    catch { setLocal(local); }
  }

  return (
    <>
      <button
        type="button"
        className="feat-subsb-row feat-subsb-row-button"
        onClick={() => setOpen(true)}
        disabled={loading}
      >
        <span className="feat-subsb-row-icon" aria-hidden="true">{I.skills}</span>
        <span className="feat-subsb-row-label as-text">{s.skillsPanel}</span>
        {local.length > 0 && <span className="feat-subsb-row-count">{local.length}</span>}
        <span className="feat-subsb-row-chev" aria-hidden="true">{I.chevR}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept=".md,.txt,.json,.yaml,.yml,.prompt"
        onChange={onFiles}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={s.skillsPanel}
        width={520}
      >
        {local.length === 0 ? (
          <div className="feat-card-empty">{s.skillsPanelDesc}</div>
        ) : (
          <ul className="feat-files feat-files-modal">
            {local.map((name) => (
              <li key={name} className="feat-file-row">
                <span className="feat-file-icon">{I.doc}</span>
                <span className="feat-file-name" title={name}>{name}</span>
                <button
                  type="button"
                  className="feat-file-del"
                  onClick={() => remove(name)}
                  aria-label={s.remove}
                  title={s.remove}
                >×</button>
              </li>
            ))}
          </ul>
        )}
        <div className="feat-modal-foot">
          <button
            type="button"
            className="feat-btn-secondary"
            onClick={() => setOpen(false)}
          >{s.cancel}</button>
          <button
            type="button"
            className="feat-btn-primary"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >{busy ? s.saving : s.addSkill}</button>
        </div>
      </Modal>
    </>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────
function prettyBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
