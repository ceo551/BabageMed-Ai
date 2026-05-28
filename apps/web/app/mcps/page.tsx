"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  mcps,
  connectors as connectorsApi,
  type McpServer,
  type Connector,
} from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useUI } from "../lib/ui-context";
import { ConnectorIcon } from "../components/ConnectorIcon";
import { featureIcon } from "../icons";
import "./mcps.css";

// "Connectors" directory (mounted at /mcps for backwards-compatible URLs).
// Each card shows the provider's favicon, kind, and a "+" button to install
// in one click. If already connected, the button flips to "✓".
//
// The previous tester-style page (search-by-id grid that linked to per-tool
// forms) was replaced with this Claude-style directory.
// Page size for the catalog grid. With ~540 servers we render lazily —
// 60 cards on first paint, then "Show more" reveals the next 60. This keeps
// the initial layout under ~200 KB of DOM and the search filter responsive.
const PAGE_SIZE = 60;

export default function ConnectorsBrowsePage() {
  const { user } = useAuth();
  const { s } = useUI();
  const [all, setAll] = useState<McpServer[]>([]);
  const [mine, setMine] = useState<Record<string, Connector>>({});
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "api" | "scrape" | "hybrid">("all");
  const [feature, setFeature] = useState<string>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [shown, setShown] = useState<number>(PAGE_SIZE);
  // Reset pagination whenever the filter changes so the user always sees the
  // top of the result set after typing.
  useEffect(() => { setShown(PAGE_SIZE); }, [q, kind, feature]);

  useEffect(() => {
    mcps.list()
      .then((r) => setAll(r.servers))
      .catch((e) => setError(e.error || String(e)));
  }, []);

  useEffect(() => {
    if (!user) {
      setMine({});
      return;
    }
    connectorsApi.list()
      .then((cs) => setMine(Object.fromEntries(cs.map((c) => [c.mcpId, c]))))
      .catch(() => setMine({}));
  }, [user]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((srv) => {
      if (kind !== "all" && srv.kind !== kind) return false;
      if (feature !== "all" && srv.feature !== feature) return false;
      if (!needle) return true;
      return (
        srv.id.toLowerCase().includes(needle) ||
        srv.name.toLowerCase().includes(needle) ||
        srv.base.toLowerCase().includes(needle)
      );
    });
  }, [all, q, kind, feature]);

  async function toggle(s: McpServer) {
    if (!user) {
      // Anonymous click — bounce to login.
      window.location.href = "/login";
      return;
    }
    setBusy(s.id);
    try {
      if (mine[s.id]) {
        await connectorsApi.disconnect(s.id);
        setMine((m) => {
          const next = { ...m };
          delete next[s.id];
          return next;
        });
      } else {
        const c = await connectorsApi.connect(s.id);
        setMine((m) => ({ ...m, [s.id]: c }));
      }
    } catch (e: any) {
      setError(e?.error || String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mcps-shell">
      <Link href="/" style={{ color: "var(--cyan)", fontSize: 13 }}>← Dashboard</Link>
      <h1>Connectors</h1>
      <p className="lead">
        Browse all {all.length || "…"} integrations and add any with one click.
        Connected ones surface in the chat composer "+" menu and the assistant can
        retrieve from them when relevant.
      </p>

      <div className="mcps-toolbar">
        <input
          type="search"
          placeholder={s.searchConnectorsPlaceholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <FeatureDropdown
          value={feature}
          onChange={setFeature}
          features={s.features}
          allLabel={s.allFeaturesFilter}
        />
        <select value={kind} onChange={(e) => setKind(e.target.value as "all" | "api" | "scrape" | "hybrid")}>
          <option value="all">{s.allKinds}</option>
          <option value="api">{s.apiKind}</option>
          <option value="scrape">{s.scrapeKind}</option>
          <option value="hybrid">{s.hybridKind}</option>
        </select>
        <span className="mcps-counts">{filtered.length} / {all.length}</span>
      </div>

      {error && (
        <div
          className="auth-err"
          style={{
            borderRadius: 10,
            padding: 10,
            border: "1px solid var(--purple-line)",
            background: "var(--purple-soft)",
            color: "var(--purple)",
          }}
        >
          {error}
        </div>
      )}

      {/* When the user has no filter active, show a Perplexity-style
          per-feature grouping (each feature gets its own row with the first
          ~8 connectors + a "View all" link). Otherwise fall back to the
          flat filtered grid + pager. */}
      {q.trim() === "" && feature === "all" && kind === "all" ? (
        <FeatureSections
          servers={filtered}
          features={s.features}
          mine={mine}
          busy={busy}
          onToggle={toggle}
          onViewAll={(slug) => setFeature(slug)}
        />
      ) : (
        <>
          <div className="mcps-grid">
            {filtered.slice(0, shown).map((s) => (
              <ConnectorCard
                key={s.id}
                server={s}
                isMine={!!mine[s.id]}
                isBusy={busy === s.id}
                onToggle={toggle}
              />
            ))}
          </div>
          {filtered.length > shown && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
              <button
                type="button"
                className="connect-btn"
                style={{
                  padding: "10px 22px",
                  borderRadius: 999,
                  fontSize: 13,
                  background: "var(--cyan-soft)",
                  color: "var(--cyan)",
                  border: "1px solid var(--cyan-line)",
                }}
                onClick={() => setShown((n) => n + PAGE_SIZE)}
              >
                Show {Math.min(PAGE_SIZE, filtered.length - shown)} more · {filtered.length - shown} left
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Custom dropdown for "All features" with SVG icons.
// Native <select> can't render SVG inside <option> and its dark-mode styling
// is OS-controlled (which made the labels nearly invisible on dark themes).
// This popover-based version uses the same featureIcon() set as the sidebar
// and follows our theme tokens so contrast is consistent in both modes.
function FeatureDropdown({
  value,
  onChange,
  features,
  allLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  features: ReadonlyArray<{ slug: string; label: string; emoji: string }>;
  allLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const selected = value === "all"
    ? { slug: "all", label: allLabel, emoji: "★" }
    : features.find((f) => f.slug === value) || { slug: "all", label: allLabel, emoji: "★" };
  return (
    <div className="mcps-fdrop" ref={rootRef}>
      <button
        type="button"
        className="mcps-fdrop-trigger"
        data-open={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="mcps-fdrop-icon">{featureIcon(selected.slug, selected.emoji)}</span>
        <span className="mcps-fdrop-label">{selected.label}</span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
             strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="mcps-fdrop-pop" role="menu">
          <button
            type="button"
            className="mcps-fdrop-item"
            data-active={value === "all"}
            onClick={() => { onChange("all"); setOpen(false); }}
          >
            <span className="mcps-fdrop-icon">{featureIcon("all", "★")}</span>
            <span>{allLabel}</span>
          </button>
          {features.map((f) => (
            <button
              key={f.slug}
              type="button"
              className="mcps-fdrop-item"
              data-active={value === f.slug}
              onClick={() => { onChange(f.slug); setOpen(false); }}
            >
              <span className="mcps-fdrop-icon">{featureIcon(f.slug, f.emoji)}</span>
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared card renderer — used by both flat grid and grouped sections.
function ConnectorCard({
  server,
  isMine,
  isBusy,
  onToggle,
}: {
  server: McpServer;
  isMine: boolean;
  isBusy: boolean;
  onToggle: (s: McpServer) => void;
}) {
  return (
    <div className="mcp-card" data-connected={isMine}>
      <Link href={`/mcps/${encodeURIComponent(server.id)}`} className="card-body">
        <div className="row">
          <ConnectorIcon id={server.id} name={server.name} iconUrl={server.iconUrl} size={36} className="card-icon" />
          <span className="name">{server.name}</span>
          <span className={`kind ${server.kind}`}>{server.kind}</span>
        </div>
        <div className="meta">{server.base}</div>
        <div className="meta" style={{ color: "var(--muted-2)" }}>{server.category}</div>
      </Link>
      <button
        type="button"
        className="connect-btn"
        data-connected={isMine}
        onClick={(e) => { e.preventDefault(); onToggle(server); }}
        disabled={isBusy}
        aria-label={isMine ? "Disconnect" : "Add connector"}
        title={isMine ? "Disconnect" : "Add connector"}
        // (kept inline for the icon-only "+/✓" button; full localization
        // would need useUI() inside ConnectorCard which is a pure render
        // child — short-form deferred.)
      >
        {isBusy ? "…" : isMine ? "✓" : "+"}
      </button>
    </div>
  );
}

// ── Perplexity-style: one row per feature, top N + "View all" link.
function FeatureSections({
  servers,
  features,
  mine,
  busy,
  onToggle,
  onViewAll,
}: {
  servers: McpServer[];
  features: ReadonlyArray<{ slug: string; label: string; emoji: string }>;
  mine: Record<string, Connector>;
  busy: string | null;
  onToggle: (s: McpServer) => void;
  onViewAll: (slug: string) => void;
}) {
  const PREVIEW = 8;
  // Bucket by feature slug; everything without a feature lands in "other".
  const buckets: Record<string, McpServer[]> = {};
  for (const s of servers) {
    const k = s.feature || "other";
    (buckets[k] ||= []).push(s);
  }
  const orderedSections = [
    ...features
      .map((f) => ({ slug: f.slug, label: f.label, emoji: f.emoji, items: buckets[f.slug] || [] }))
      .filter((sec) => sec.items.length > 0),
    ...(buckets["other"]?.length
      ? [{ slug: "other", label: "Other", emoji: "•", items: buckets["other"] }]
      : []),
  ];
  return (
    <div className="mcps-sections">
      {orderedSections.map((sec) => (
        <section key={sec.slug} className="mcps-section">
          <header className="mcps-section-head">
            <span className="mcps-section-icon" aria-hidden="true">
              {featureIcon(sec.slug, sec.emoji)}
            </span>
            <h2 className="mcps-section-title">{sec.label}</h2>
            <span className="mcps-section-count">{sec.items.length}</span>
            {sec.items.length > PREVIEW && sec.slug !== "other" && (
              <button
                type="button"
                className="mcps-section-viewall"
                onClick={() => onViewAll(sec.slug)}
              >
                View all →
              </button>
            )}
          </header>
          <div className="mcps-grid">
            {sec.items.slice(0, PREVIEW).map((s) => (
              <ConnectorCard
                key={s.id}
                server={s}
                isMine={!!mine[s.id]}
                isBusy={busy === s.id}
                onToggle={onToggle}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
