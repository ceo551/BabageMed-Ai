"use client";

import { notFound, useParams } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { useUI } from "../../lib/ui-context";
import { useAuth } from "../../lib/auth-context";
import { features as featuresApi, mcps as mcpsApi, type Feature, type FeatureFile, type McpServer } from "../../lib/api";
import { ConnectorIcon } from "../../components/ConnectorIcon";
import { I } from "../../icons";
import "./feature.css";

// Per-feature workspace page — mirrors the second mockup the user shipped:
//   ┌─────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
//   │  (sidebar)  │ │ Composer + recents   │ │ Instructions │ Files │
//   │             │ │                      │ │ Skills │ Connectors  │
//   └─────────────┘ └──────────────────────┘ └──────────────────────┘
//
// Composer + recents live in the dashboard component; this page renders the
// rightmost rail: four stacked cards for Instructions / Files / Skills /
// Connectors. Each card is independently editable and autosaves to the
// backend's feature row (slug = category id).
export default function FeaturePage() {
  const { slug } = useParams<{ slug: string }>();
  const { s, locale } = useUI();
  const { user, loading: authLoading } = useAuth();
  const meta = s.features.find((f) => f.slug === slug);
  if (!meta && !authLoading) {
    // Unknown slug — punt to dashboard rather than throwing a wall of error.
    if (typeof window !== "undefined") notFound();
    return null;
  }

  const [feature, setFeature] = useState<Feature | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch (or lazily create) the feature row for this slug. The backend will
  // upsert on the first GET so the client never has to handle a 404 here.
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
        <p className="lead">Sign in to customise this feature's instructions, files, skills and connectors.</p>
      </div>
    );
  }
  if (!meta) return null;

  return (
    <div className="feat-shell" data-color={meta.color}>
      <header className="feat-hero">
        <span className="feat-emoji" aria-hidden="true">{meta.emoji}</span>
        <div className="feat-hero-text">
          <h1>{meta.label}</h1>
          <p className="lead">
            {locale === "ar"
              ? "اضبط التعليمات، أضف ملفات، اختر المهارات، وقم بربط الموصّلات الخاصة بهذه الميزة."
              : "Tune the instructions, upload files, pick skills, and connect MCP servers for this workflow."}
          </p>
        </div>
      </header>

      {error && (
        <div className="feat-err">{error}</div>
      )}

      <div className="feat-grid">
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
      </div>
    </div>
  );
}

// ─── Instructions card ────────────────────────────────────────────────────
// Textarea with a debounced autosave. The pencil-icon header matches the
// sketch the user provided.
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
  // Keep the textarea in sync if the backend value changes (e.g. first fetch)
  useEffect(() => { setDraft(value); }, [value]);

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
            rows={6}
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
// Catalog comes from the static SKILL_CATALOG below. Toggle = select/deselect.
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
  const set = new Set(selected);
  function toggle(id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(Array.from(next));
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
// Reads the full MCP catalog (~540 servers), filters by:
//   - search text box (case-insensitive substring match on name + id)
//   - the feature's preferred slug (servers tagged with feature===slug land
//     at the top so users see the most-relevant connectors first)
// Multi-select toggles persist immediately via featuresApi.update.
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
  const set = new Set(selected);

  useEffect(() => {
    let cancelled = false;
    mcpsApi.list()
      .then(({ servers }) => { if (!cancelled) setCatalog(servers); })
      .catch(() => { if (!cancelled) setCatalog([]); })
      .finally(() => { if (!cancelled) setLoadingCat(false); });
    return () => { cancelled = true; };
  }, []);

  function toggle(id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(Array.from(next));
  }

  // Filter + rank: matching servers first, then alphabetical by name. Servers
  // tagged with `feature === featureSlug` get a free 1000-point boost so the
  // most-relevant connectors land at the top of the list before any search.
  const query = q.trim().toLowerCase();
  const filtered = catalog
    .filter((m) => {
      if (!query) return true;
      return m.name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query);
    })
    .map((m) => ({
      m,
      score:
        ((m as any).feature === featureSlug ? 1000 : 0) +
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
