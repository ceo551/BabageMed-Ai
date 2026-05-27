"use client";

import { notFound, useParams } from "next/navigation";
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useUI } from "../../lib/ui-context";
import { useAuth } from "../../lib/auth-context";
import { features as featuresApi, mcps as mcpsApi, type Feature, type FeatureFile, type McpServer } from "../../lib/api";
import { ConnectorIcon } from "../../components/ConnectorIcon";
import { I } from "../../icons";
import { FeatureChat } from "./FeatureChat";
import { FeatureSubSidebar } from "./FeatureSubSidebar";
import "./feature.css";

// Per-feature workspace page — three-column layout:
//
//   ┌─────────────────┬──────────────────────────┬──────────────────┐
//   │ sub-sidebar     │ composer + transcript    │ right rail       │
//   │ • feature name  │ • central prompt box     │ • Instructions   │
//   │ • New chat      │ • per-feature chat       │ • Files          │
//   │ • this feature's│   history scoped to slug │ • Skills         │
//   │   chat history  │                          │ • Connectors     │
//   └─────────────────┴──────────────────────────┴──────────────────┘
//
// The right rail keeps the original "configure this feature" cards. The
// sub-sidebar is visually flush with the global Sidebar so the UI reads
// like a single nav surface — "main sidebar holds the catalog of
// features; per-feature sidebar holds that feature's chats and tools".
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
  const meta = s.features.find((f) => f.slug === slug);

  // Unknown slug — surface a 404 instead of rendering a broken shell.
  if (!meta && !authLoading) {
    if (typeof window !== "undefined") notFound();
    return null;
  }

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

  if (authLoading) return <div className="feat-shell"><p className="lead">Loading…</p></div>;
  if (!user) {
    return (
      <div className="feat-shell">
        <h1>{meta?.label}</h1>
        <p className="lead">
          {locale === "ar"
            ? "سجّل الدخول لاستخدام هذه الميزة، وإدارة التعليمات والملفات والمهارات الخاصة بها."
            : "Sign in to use this feature and customise its instructions, files, skills and connectors."}
        </p>
      </div>
    );
  }
  if (!meta) return null;

  return (
    <div className="feat-shell feat-shell-3col" data-color={meta.color}>
      <FeatureSubSidebar meta={meta} />

      <section className="feat-main">
        {error && <div className="feat-err">{error}</div>}
        <FeatureChat meta={meta} feature={feature} />
      </section>

      <aside className="feat-rail" aria-label={locale === "ar" ? "خصائص الميزة" : "Feature settings"}>
        <InstructionsCard
          loading={loading}
          value={feature?.instructions || ""}
          onSave={async (v) => {
            const updated = await featuresApi.update(meta.slug, { instructions: v });
            setFeature(updated);
          }}
        />
        <FilesCard
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
        <SkillsCard
          loading={loading}
          selected={feature?.skills || []}
          onChange={async (skills) => {
            const updated = await featuresApi.update(meta.slug, { skills });
            setFeature(updated);
          }}
        />
        <ConnectorsCard
          loading={loading}
          selected={feature?.connectors || []}
          featureSlug={meta.slug}
          onChange={async (connectors) => {
            const updated = await featuresApi.update(meta.slug, { connectors });
            setFeature(updated);
          }}
        />
      </aside>
    </div>
  );
}

// ─── Instructions card ────────────────────────────────────────────────────
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
  const [draft, setDraft] = useState(value);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => () => { if (tRef.current) clearTimeout(tRef.current); }, []);

  function onInput(v: string) {
    setDraft(v);
    setStatus("saving");
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(async () => {
      try { await onSave(v); setStatus("saved"); }
      catch { setStatus("idle"); }
    }, 700);
  }

  return (
    <section className="feat-card" aria-label={s.instructions}>
      <header className="feat-card-head">
        <h3>{s.instructions}</h3>
        <span className="feat-card-edit" aria-hidden="true">{I.edit}</span>
      </header>
      {loading ? (
        <div className="feat-card-skel" aria-busy="true" />
      ) : (
        <>
          <textarea
            className="feat-instr-input"
            placeholder={s.instructionsDesc}
            value={draft}
            onChange={(e) => onInput(e.target.value)}
            rows={5}
          />
          <div className="feat-card-foot">
            <span className="feat-save-status">
              {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
            </span>
          </div>
        </>
      )}
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
                aria-label="Remove file"
                title="Remove"
              >×</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Skills card ─────────────────────────────────────────────────────────
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
  React.useEffect(() => { setLocal(selected); }, [selected]);
  const set = React.useMemo(() => new Set(local), [local]);

  const pendingRef = React.useRef<Promise<void>>(Promise.resolve());
  function toggle(id: string) {
    setLocal((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      const arr = Array.from(next);
      pendingRef.current = pendingRef.current.then(() => onChange(arr).catch(() => {}));
      return arr;
    });
  }
  return (
    <section className="feat-card" aria-label={s.skillsPanel}>
      <header className="feat-card-head">
        <h3>{s.skillsPanel}</h3>
      </header>
      {loading ? (
        <div className="feat-card-skel" aria-busy="true" />
      ) : (
        <ul className="feat-skills">
          {SKILL_CATALOG.map((sk) => (
            <li key={sk.id}>
              <button
                type="button"
                className="feat-skill-row"
                data-active={set.has(sk.id)}
                onClick={() => toggle(sk.id)}
              >
                <span className="feat-skill-name">{sk.name}</span>
                <span className="feat-skill-desc">{sk.desc}</span>
                {set.has(sk.id) && <span className="feat-skill-check">{I.check}</span>}
              </button>
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
  const filtered = catalog
    .filter((m) => {
      if (!query) return true;
      return m.name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query);
    })
    .map((m) => ({
      m,
      score:
        (m.feature === featureSlug ? 1000 : 0) +
        (set.has(m.id) ? 500 : 0),
    }))
    .sort((a, b) => (b.score - a.score) || a.m.name.localeCompare(b.m.name));

  const showLimit = 40;
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

const SKILL_CATALOG: Array<{ id: string; name: string; desc: string }> = [
  { id: "summarize",   name: "Summarize",            desc: "Condense long text into key bullets." },
  { id: "translate",   name: "Translate",            desc: "Render between languages preserving tone." },
  { id: "cite",        name: "Cite sources",         desc: "Add inline citations to every claim." },
  { id: "stepwise",    name: "Step-by-step",         desc: "Show reasoning explicitly before the answer." },
  { id: "table",       name: "Tableize",             desc: "Pivot answer into a comparison table." },
  { id: "rewrite",     name: "Rewrite",              desc: "Improve clarity, tighten, fix grammar." },
];
