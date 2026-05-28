"use client";

import { notFound, useParams } from "next/navigation";
import React, { Suspense, useEffect, useRef, useState } from "react";
import { useUI } from "../../lib/ui-context";
import { useAuth } from "../../lib/auth-context";
import { usePrefs } from "../../lib/store";
import { features as featuresApi, type Feature, type FeatureFile } from "../../lib/api";
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

// ─── helpers ──────────────────────────────────────────────────────────────
function prettyBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

