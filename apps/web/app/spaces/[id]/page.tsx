"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import React, { Suspense, useEffect, useRef, useState } from "react";
import { useUI } from "../../lib/ui-context";
import { useAuth } from "../../lib/auth-context";
import { spaces as spacesApi, type Space, type SpaceFile } from "../../lib/api";
import { I } from "../../icons";
import { Modal } from "../../components/Modal";
import { SpaceChat } from "./SpaceChat";
import "../spaces.css";

// Per-space workspace — Perplexity Spaces / Claude project-detail layout:
//
//   ┌──────────────────────────────────────────────────────────────────┐
//   │ ← All spaces   🗂  Space name + description            ⋮          │
//   ├───────────────────────────────────────────┬──────────────────────┤
//   │ SpaceChat (composer + transcript)          │  Instructions card   │
//   │                                            │  Files card          │
//   │                                            │  Skills card         │
//   └───────────────────────────────────────────┴──────────────────────┘
//
// The right rail stacks below the chat under ~1000px.
export default function SpacePage() {
  return (
    <Suspense fallback={<div className="sp-loading"><span className="ps-spinner" />Loading…</div>}>
      <SpacePageInner />
    </Suspense>
  );
}

function SpacePageInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { s, locale } = useUI();
  const { user, loading: authLoading } = useAuth();

  const [space, setSpace] = useState<Space | null>(null);
  const [files, setFiles] = useState<SpaceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Header overflow menu + rename dialog state.
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [savingRename, setSavingRename] = useState(false);

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

  // Close the header overflow menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest?.(".sp-menu-wrap")) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setMenuOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function refreshFiles() {
    try {
      const fl = await spacesApi.files(id);
      setFiles(fl);
      // Keep the header/index file count in sync after add/remove.
      setSpace((sp) => (sp ? { ...sp, fileCount: fl.length } : sp));
    } catch { /* keep current */ }
  }

  function openRename() {
    if (!space) return;
    setMenuOpen(false);
    setRenameDraft(space.name || "");
    setRenaming(true);
  }
  async function submitRename() {
    if (!space) return;
    const name = renameDraft.trim();
    if (!name || name === space.name) { setRenaming(false); return; }
    setSavingRename(true);
    try {
      const updated = await spacesApi.update(id, { name });
      // Merge, don't replace — the update response may omit derived fields
      // (e.g. fileCount) that we already hold.
      setSpace((sp) => (sp ? { ...sp, ...updated } : updated));
      setRenaming(false);
    } catch {
      // Leave the dialog open so the user can retry.
    } finally {
      setSavingRename(false);
    }
  }
  async function deleteSpace() {
    setMenuOpen(false);
    if (typeof window !== "undefined" && !window.confirm(s.deleteSpaceConfirm)) return;
    try {
      await spacesApi.remove(id);
      router.push("/spaces");
    } catch (e) {
      setError((e as { error?: string })?.error || s.deleteSpace);
    }
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
  if (notFound) {
    return (
      <div className="sp-gate">
        <h1>{s.spaceNotFound}</h1>
        <p><Link href="/spaces" className="sp-back">{s.allSpaces}</Link></p>
      </div>
    );
  }
  if (loading && !space) {
    return <div className="sp-loading"><span className="ps-spinner" />{s.loadingChats}</div>;
  }
  if (!space) {
    return (
      <div className="sp-gate">
        <h1>{s.noSpacesYet}</h1>
        {error && <p>{error}</p>}
        <p><Link href="/spaces" className="sp-back">{s.allSpaces}</Link></p>
      </div>
    );
  }

  return (
    <div className="space-page">
      <header className="sp-head">
        <Link href="/spaces" className="sp-back">
          <span className="sp-back-arrow" aria-hidden="true">←</span>
          <span>{s.allSpaces}</span>
        </Link>
        <div className="sp-head-main">
          <span className="sp-head-emoji" aria-hidden="true">{space.icon || "📁"}</span>
          <div className="sp-head-text">
            <h1 className="sp-head-name" title={space.name}>{space.name}</h1>
            {space.description ? (
              <p className="sp-head-desc" title={space.description}>{space.description}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="sp-newthread-btn"
            onClick={() => router.push(`/spaces/${encodeURIComponent(id)}?n=${Date.now()}`)}
            title={s.newThread}
          >
            {I.plus}<span>{s.newThread}</span>
          </button>
          <div className="sp-menu-wrap">
            <button
              type="button"
              className="sp-menu-btn"
              aria-label={s.more}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {I.dotsV}
            </button>
            {menuOpen && (
              <div className="sp-menu" role="menu">
                <button type="button" className="sp-menu-item" onClick={openRename}>
                  {I.edit}<span>{s.rename}</span>
                </button>
                <button type="button" className="sp-menu-item is-danger" onClick={deleteSpace}>
                  {I.trash}<span>{s.deleteSpace}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="sp-body">
        <section className="sp-chat-col">
          {error && <div className="feat-err" style={{ margin: "12px 24px 0" }}>{error}</div>}
          <SpaceChat space={space} />
        </section>

        <aside className="sp-rail" aria-label={s.spacesHeader}>
          <InstructionsCard
            value={space.instructions || ""}
            onSave={async (v) => {
              // Surface failures (and re-throw) so the card stays in edit mode
              // for a retry instead of silently swallowing the error.
              try {
                const updated = await spacesApi.update(id, { instructions: v });
                setSpace((sp) => (sp ? { ...sp, ...updated } : updated));
                setError(null);
              } catch (e) {
                setError((e as { error?: string })?.error || s.save);
                throw e;
              }
            }}
          />
          <FilesCard
            files={files}
            onUpload={async (fl) => {
              // Backend takes ONE file per call — loop, isolating per-file
              // failures so a single bad file doesn't silently drop the rest.
              const errs: string[] = [];
              for (const f of Array.from(fl)) {
                try { await spacesApi.upload(id, f); }
                catch (e) { errs.push(`${f.name}: ${(e as { error?: string })?.error || "failed"}`); }
              }
              await refreshFiles();
              setError(errs.length ? errs.join("; ") : null);
            }}
            onRemove={async (fileId) => {
              try { await spacesApi.removeFile(id, fileId); setError(null); }
              catch (e) { setError((e as { error?: string })?.error || s.remove); }
              finally { await refreshFiles(); }
            }}
          />
          <SkillsCard
            skills={space.skills || []}
            onChange={async (skills) => {
              try {
                const updated = await spacesApi.update(id, { skills });
                setSpace((sp) => (sp ? { ...sp, ...updated } : updated));
                setError(null);
              } catch (e) {
                setError((e as { error?: string })?.error || s.save);
                throw e;
              }
            }}
          />
        </aside>
      </div>

      {/* Rename dialog */}
      <Modal open={renaming} onClose={() => setRenaming(false)} title={s.rename} width={420}>
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
          <button
            type="button"
            className="feat-btn-secondary"
            onClick={() => setRenaming(false)}
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

// ─── Instructions card (inline editing, Perplexity-style) ─────────────────
function InstructionsCard({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
}) {
  const { s } = useUI();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  // Only sync the draft from the prop while NOT editing — otherwise a parent
  // re-render (e.g. right after a save resolves) would clobber in-progress edits.
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  async function save() {
    setSaving(true);
    // onSave re-throws on failure; keep the editor open so the user can retry.
    try { await onSave(draft); setEditing(false); }
    catch { /* error already surfaced by the parent */ }
    finally { setSaving(false); }
  }

  return (
    <div className="sp-rail-card">
      <div className="sp-rail-head">
        <span className="sp-rail-icon" aria-hidden="true">{I.doc}</span>
        <span className="sp-rail-title">{s.instructions}</span>
        <button
          type="button"
          className="sp-rail-add"
          onClick={() => { setDraft(value); setEditing(true); }}
          aria-label={s.instructions}
          title={s.instructions}
        >{I.edit}</button>
      </div>

      {editing ? (
        <>
          <textarea
            className="sp-instr-textarea"
            placeholder={s.instructionsTellHint}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            autoFocus
          />
          <div className="sp-edit-foot">
            <button
              type="button"
              className="feat-btn-secondary"
              onClick={() => { setDraft(value); setEditing(false); }}
              disabled={saving}
            >{s.cancel}</button>
            <button
              type="button"
              className="feat-btn-primary"
              onClick={save}
              disabled={saving}
            >{saving ? s.saving : s.save}</button>
          </div>
        </>
      ) : value ? (
        <button
          type="button"
          className="sp-instr-preview"
          onClick={() => { setDraft(value); setEditing(true); }}
        >{value}</button>
      ) : (
        <p className="sp-rail-desc">{s.instructionsTellHint}</p>
      )}
    </div>
  );
}

// ─── Files card ───────────────────────────────────────────────────────────
function FilesCard({
  files,
  onUpload,
  onRemove,
}: {
  files: SpaceFile[];
  onUpload: (fl: FileList) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const { s } = useUI();
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
    <div className="sp-rail-card">
      <div className="sp-rail-head">
        <span className="sp-rail-icon" aria-hidden="true">{I.folder}</span>
        <span className="sp-rail-title">{s.filesFolders}</span>
        <button
          type="button"
          className="sp-rail-add"
          onClick={() => inputRef.current?.click()}
          aria-label={s.addFile}
          title={s.addFile}
          disabled={busy}
        >{I.plus}</button>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept=".pdf,.txt,.md,.csv,.json,.docx,.html"
        onChange={onFiles}
      />

      {files.length === 0 ? (
        <div className="sp-dropzone">{s.filesHint}</div>
      ) : (
        <ul className="sp-file-list">
          {files.map((f) => (
            <li key={f.id} className="sp-file-row">
              <span className="sp-file-icon" aria-hidden="true">{I.doc}</span>
              <span className="sp-file-name" title={f.name}>{f.name}</span>
              <span className="sp-file-size">{prettyBytes(f.sizeBytes)}</span>
              <button
                type="button"
                className="sp-row-del"
                onClick={() => onRemove(f.id)}
                aria-label={s.remove}
                title={s.remove}
              >×</button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="sp-add-dashed"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        {I.plus}<span>{busy ? s.saving : s.addFile}</span>
      </button>
    </div>
  );
}

// ─── Skills card ──────────────────────────────────────────────────────────
function SkillsCard({
  skills,
  onChange,
}: {
  skills: string[];
  onChange: (skills: string[]) => Promise<void>;
}) {
  const { s } = useUI();
  const [local, setLocal] = useState<string[]>(skills);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setLocal(skills); }, [skills]);

  // Skills are plain text labels passed to the model as enabled capabilities
  // for this space — they are NOT files. (The old file-picker stored only the
  // filename and silently discarded the content, which was misleading.)
  async function add() {
    const name = draft.trim();
    if (!name || local.includes(name)) { setDraft(""); return; }
    const prev = local;
    const next = [...local, name];
    setLocal(next);
    setDraft("");
    setBusy(true);
    try { await onChange(next); }
    catch { setLocal(prev); }
    finally { setBusy(false); }
  }

  async function remove(name: string) {
    const prev = local;
    const next = local.filter((x) => x !== name);
    setLocal(next);
    try { await onChange(next); }
    catch { setLocal(prev); }
  }

  return (
    <div className="sp-rail-card">
      <div className="sp-rail-head">
        <span className="sp-rail-icon" aria-hidden="true">{I.skills}</span>
        <span className="sp-rail-title">{s.skillsPanel}</span>
      </div>

      {local.length === 0 ? (
        <div className="sp-dropzone">{s.skillsHint}</div>
      ) : (
        <div className="sp-chips">
          {local.map((name) => (
            <span key={name} className="sp-chip">
              <span className="sp-chip-name" title={name}>{name}</span>
              <button
                type="button"
                className="sp-row-del"
                onClick={() => remove(name)}
                aria-label={s.remove}
                title={s.remove}
              >×</button>
            </span>
          ))}
        </div>
      )}

      <div className="sp-skill-add">
        <input
          type="text"
          className="feat-modal-input"
          placeholder={s.addSkill}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          disabled={busy}
        />
        <button
          type="button"
          className="sp-add-dashed"
          onClick={add}
          disabled={busy || !draft.trim()}
        >
          {I.plus}<span>{busy ? s.saving : s.addSkill}</span>
        </button>
      </div>
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────
function prettyBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
