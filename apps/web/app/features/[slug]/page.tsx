"use client";

import { notFound, useParams } from "next/navigation";
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useUI } from "../../lib/ui-context";
import { useAuth } from "../../lib/auth-context";
import { usePrefs } from "../../lib/store";
import { features as featuresApi, mcps as mcpsApi, type Feature, type FeatureFile, type McpServer } from "../../lib/api";
import { ConnectorIcon } from "../../components/ConnectorIcon";
import { I } from "../../icons";
import { Modal } from "../../components/Modal";
import { FeatureChat } from "./FeatureChat";
import { FeatureSubSidebar } from "./FeatureSubSidebar";
import "./feature.css";

// Per-feature workspace page — two-column layout:
//
//   ┌─────────────────────────────┬──────────────────────────────────┐
//   │ sub-sidebar                 │ composer + transcript            │
//   │ • feature name              │ • central prompt box             │
//   │ • New chat                  │ • per-feature chat               │
//   │ • this feature's chats      │   history scoped to slug         │
//   │ • Instructions / Files /    │                                  │
//   │   Skills / Connectors cards │                                  │
//   └─────────────────────────────┴──────────────────────────────────┘
//
// The four configuration cards live inside the sub-sidebar (folded in
// from the previous right rail) so the whole feature surface — chats +
// config — sits in one rail next to the chat column.
export default function FeaturePage() {
  return (
    <Suspense fallback={<div className="feat-shell"><p className="lead">Loading…</p></div>}>
      <FeaturePageInner />
    </Suspense>
  );
}

function FeaturePageInner() {
  const { slug } = useParams<{ slug: string }>();
  const { s, locale } = useUI();
  const { user, loading: authLoading } = useAuth();
  const { subSidebarWidth, subSidebarCollapsed } = usePrefs();
  const meta = s.features.find((f) => f.slug === slug);

  // All useState / useEffect calls run unconditionally before any early
  // returns — bailing out before them would violate the Rules of Hooks
  // (the next render would see a different number of hooks called).
  const [feature, setFeature] = useState<Feature | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !meta) return;
    let cancelled = false;
    setLoading(true);
    featuresApi.get(meta.slug)
      .then((f) => { if (!cancelled) setFeature(f); })
      .catch((e) => { if (!cancelled) setError(e?.error || String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authLoading, user, meta?.slug]);

  // Effect-based 404 (after the hook order above is stable). Putting
  // this in an effect also stops the server side from triggering
  // notFound() during static prerender — only the client navigates.
  useEffect(() => {
    if (!authLoading && !meta) notFound();
  }, [authLoading, meta]);

  if (authLoading) return <div className="feat-shell"><p className="lead">Loading…</p></div>;
  if (!meta) return null;
  if (!user) {
    return (
      <div className="feat-shell">
        <h1>{meta.label}</h1>
        <p className="lead">
          {locale === "ar"
            ? "سجّل الدخول لاستخدام هذه الميزة، وإدارة التعليمات والملفات والمهارات الخاصة بها."
            : "Sign in to use this feature and customise its instructions, files, skills and connectors."}
        </p>
      </div>
    );
  }

  // Compact pill-style rows for the per-feature config — replaces the
  // previous full cards. Instructions is an inline pill with its own (+)
  // button that opens the editor modal; Files / Skills open dialogs that
  // list current entries with an Add action inside. Connectors panel has
  // been removed from the sub-sidebar entirely.
  const panels = (
    <>
      <InstructionsRow
        loading={loading}
        value={feature?.instructions || ""}
        onSave={async (v) => {
          const updated = await featuresApi.update(meta.slug, { instructions: v });
          setFeature(updated);
        }}
      />
      <FilesRow
        loading={loading}
        files={feature?.files || []}
        onUpload={async (fl) => {
          const upd = await featuresApi.upload(meta.slug, fl);
          setFeature(upd);
        }}
        onRemove={async (id) => {
          const upd = await featuresApi.removeFile(meta.slug, id);
          setFeature(upd);
        }}
      />
      <SkillsRow
        loading={loading}
        selected={feature?.skills || []}
        onChange={async (skills) => {
          const updated = await featuresApi.update(meta.slug, { skills });
          setFeature(updated);
        }}
      />
    </>
  );

  return (
    <div
      className="feat-shell feat-shell-2col"
      data-color={meta.color}
      data-subsb-collapsed={subSidebarCollapsed}
      style={{
        "--subsb-w": `${subSidebarCollapsed ? 56 : subSidebarWidth}px`,
      } as React.CSSProperties}
    >
      <FeatureSubSidebar meta={meta} panels={panels} />

      <section className="feat-main">
        {error && <div className="feat-err">{error}</div>}
        <FeatureChat meta={meta} feature={feature} onFeatureUpdate={setFeature} />
      </section>
    </div>
  );
}

// ─── Instructions row ─────────────────────────────────────────────────────
// Compact pill the user can click to edit. Shape mirrors the sidebar's
// "+ New" button. A trailing (+) button opens the editor modal; clicking
// the label opens it too.
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
// Single button that opens a modal listing the feature's uploaded files
// with an "Add files" action inside. Replaces the larger inline card.
function FilesRow({
  loading,
  files,
  onUpload,
  onRemove,
}: {
  loading: boolean;
  files: FeatureFile[];
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
                <span className="feat-file-size">{prettyBytes(f.size)}</span>
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
// Same pattern as FilesRow — button opens a modal showing saved skill
// "files" (skills are tracked by filename in this MVP, see SkillsCard).
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

// ─── Instructions card ────────────────────────────────────────────────────
// Collapsed by default — the card shows a snippet of the saved instructions
// (or a "click + to add" empty state). The (+) button opens a Modal with a
// full-size textarea and explicit Cancel / Save buttons, matching the rest
// of the app's modal-driven editing flows (new chat, new space, etc).
function InstructionsCard({
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
    try {
      await onSave(draft);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="feat-card" aria-label={s.instructions}>
      <header className="feat-card-head">
        <h3>{s.instructions}</h3>
        <button
          type="button"
          className="feat-card-add"
          onClick={() => { setDraft(value); setOpen(true); }}
          aria-label={s.instructions}
          title={s.instructions}
        >
          {I.plus}
        </button>
      </header>
      {loading ? (
        <div className="feat-card-skel" aria-busy="true" />
      ) : value.trim() ? (
        <button
          type="button"
          className="feat-instr-preview"
          onClick={() => { setDraft(value); setOpen(true); }}
          title="Edit instructions"
        >
          {value}
        </button>
      ) : (
        <div className="feat-card-empty">{s.instructionsDesc}</div>
      )}

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
    </section>
  );
}

// ─── Files & folders card ────────────────────────────────────────────────
function FilesCard({
  loading,
  files,
  onUpload,
  onRemove,
}: {
  loading: boolean;
  files: FeatureFile[];
  onUpload: (fl: FileList) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const { s } = useUI();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const fl = e.target.files;
    if (!fl || fl.length === 0) return;
    setBusy(true);
    try { await onUpload(fl); } finally { setBusy(false); }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section className="feat-card" aria-label={s.filesFolders}>
      <header className="feat-card-head">
        <h3>{s.filesFolders}</h3>
        <button
          type="button"
          className="feat-card-add"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label="Add file"
        >
          {I.plus}
        </button>
      </header>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept=".pdf,.txt,.md,.csv,.json,.docx,.html"
        onChange={onFiles}
      />
      {loading ? (
        <div className="feat-card-skel" aria-busy="true" />
      ) : files.length === 0 ? (
        <div className="feat-card-empty">{s.filesFoldersDesc}</div>
      ) : (
        <ul className="feat-files">
          {files.map((f) => (
            <li key={f.id} className="feat-file-row">
              <span className="feat-file-icon">{I.folder}</span>
              <span className="feat-file-name" title={f.name}>{f.name}</span>
              <span className="feat-file-size">{prettyBytes(f.size)}</span>
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
    </section>
  );
}

// ─── Skills card ─────────────────────────────────────────────────────────
// Skills are uploaded from the user's computer — same UX as Files & folders.
// Each uploaded file's name lands in the skills array (the file's bytes
// aren't persisted to the backend in this MVP; the name is what surfaces
// to the assistant as a hint). Saved skills render as removable rows.
function SkillsCard({
  loading,
  selected,
  onChange,
}: {
  loading: boolean;
  selected: string[];
  onChange: (s: string[]) => Promise<void>;
}) {
  const { s } = useUI();
  const [local, setLocal] = React.useState<string[]>(selected);
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { setLocal(selected); }, [selected]);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const fl = e.target.files;
    if (!fl || fl.length === 0) return;
    setBusy(true);
    try {
      const names = Array.from(fl).map((f) => f.name);
      // Dedupe against the existing list (skills are stored by name, so a
      // second upload of skill.md shouldn't double-add).
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
    catch { /* roll back on failure */ setLocal(local); }
  }

  return (
    <section className="feat-card" aria-label={s.skillsPanel}>
      <header className="feat-card-head">
        <h3>{s.skillsPanel}</h3>
        <button
          type="button"
          className="feat-card-add"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label={s.addSkill}
          title={s.addSkill}
        >
          {I.plus}
        </button>
      </header>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept=".md,.txt,.json,.yaml,.yml,.prompt"
        onChange={onFiles}
      />
      {loading ? (
        <div className="feat-card-skel" aria-busy="true" />
      ) : local.length === 0 ? (
        <div className="feat-card-empty">{s.skillsPanelDesc}</div>
      ) : (
        <ul className="feat-files">
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
    </section>
  );
}

// ─── Connectors card ─────────────────────────────────────────────────────
function ConnectorsCard({
  loading,
  selected,
  onChange,
  featureSlug,
}: {
  loading: boolean;
  selected: string[];
  onChange: (s: string[]) => Promise<void>;
  featureSlug: string;
}) {
  const { s } = useUI();
  const [catalog, setCatalog] = useState<McpServer[]>([]);
  const [loadingCat, setLoadingCat] = useState(true);
  const [q, setQ] = useState("");
  const [local, setLocal] = useState<string[]>(selected);
  useEffect(() => { setLocal(selected); }, [selected]);
  const set = useMemo(() => new Set(local), [local]);
  const pendingRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    mcpsApi.list()
      .then(({ servers }) => { if (!cancelled) setCatalog(servers); })
      .catch(() => { if (!cancelled) setCatalog([]); })
      .finally(() => { if (!cancelled) setLoadingCat(false); });
    return () => { cancelled = true; };
  }, []);

  function toggle(id: string) {
    setLocal((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      const arr = Array.from(next);
      pendingRef.current = pendingRef.current.then(() => onChange(arr).catch(() => {}));
      return arr;
    });
  }

  const query = q.trim().toLowerCase();
  // Per-feature rail: only show connectors tagged for THIS feature, so a
  // healthcare workspace doesn't surface marketing/finance MCPs in its
  // picker. The /mcps directory still lets the user discover connectors
  // outside their current feature; this list is intentionally scoped.
  const filtered = catalog
    .filter((m) => m.feature === featureSlug)
    .filter((m) => {
      if (!query) return true;
      return m.name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query);
    })
    .map((m) => ({
      m,
      score: set.has(m.id) ? 500 : 0,
    }))
    .sort((a, b) => (b.score - a.score) || a.m.name.localeCompare(b.m.name));

  const showLimit = 60;
  const visible   = filtered.slice(0, showLimit);

  return (
    <section className="feat-card feat-card-tall" aria-label={s.connectorsPanel}>
      <header className="feat-card-head">
        <h3>{s.connectorsPanel}</h3>
        <span className="feat-conn-count">
          {set.size}/{catalog.length}
        </span>
      </header>
      {(loading || loadingCat) ? (
        <div className="feat-card-skel" aria-busy="true" />
      ) : (
        <>
          <input
            type="search"
            className="feat-conn-search"
            placeholder={s.addConnectorDesc}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <ul className="feat-conn-list">
            {visible.map(({ m }) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="feat-conn-row"
                  data-active={set.has(m.id)}
                  onClick={() => toggle(m.id)}
                  title={m.name}
                >
                  <ConnectorIcon id={m.id} name={m.name} iconUrl={m.iconUrl} size={18} />
                  <span className="feat-conn-name">{m.name}</span>
                  <span className="feat-conn-cat">{m.category}</span>
                  {set.has(m.id) && <span className="feat-conn-check">{I.check}</span>}
                </button>
              </li>
            ))}
            {filtered.length > showLimit && (
              <li className="feat-conn-more">
                {filtered.length - showLimit} more — refine search to narrow.
              </li>
            )}
            {filtered.length === 0 && (
              <li className="feat-conn-empty-row">No connectors match.</li>
            )}
          </ul>
        </>
      )}
    </section>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────
function prettyBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

