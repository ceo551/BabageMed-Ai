"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  mcps,
  connectors as connectorsApi,
  type McpServer,
  type Connector,
} from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { ConnectorIcon } from "../components/ConnectorIcon";
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
  const [all, setAll] = useState<McpServer[]>([]);
  const [mine, setMine] = useState<Record<string, Connector>>({});
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "api" | "scrape" | "hybrid">("all");
  const [category, setCategory] = useState<string>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [shown, setShown] = useState<number>(PAGE_SIZE);
  // Reset pagination whenever the filter changes so the user always sees the
  // top of the result set after typing.
  useEffect(() => { setShown(PAGE_SIZE); }, [q, kind, category]);

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

  const categories = useMemo(() => {
    const set = new Set(all.map((s) => s.category));
    return ["all", ...Array.from(set).sort()];
  }, [all]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((s) => {
      if (kind !== "all" && s.kind !== kind) return false;
      if (category !== "all" && s.category !== category) return false;
      if (!needle) return true;
      return (
        s.id.toLowerCase().includes(needle) ||
        s.name.toLowerCase().includes(needle) ||
        s.base.toLowerCase().includes(needle)
      );
    });
  }, [all, q, kind, category]);

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
          placeholder="Search by id, name, or URL…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={kind} onChange={(e) => setKind(e.target.value as any)}>
          <option value="all">All kinds</option>
          <option value="api">API</option>
          <option value="scrape">Scrape</option>
          <option value="hybrid">Hybrid</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c} value={c}>{c === "all" ? "All categories" : c}</option>
          ))}
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

      <div className="mcps-grid">
        {filtered.slice(0, shown).map((s) => {
          const isMine = !!mine[s.id];
          const isBusy = busy === s.id;
          return (
            <div key={s.id} className="mcp-card" data-connected={isMine}>
              <Link href={`/mcps/${encodeURIComponent(s.id)}`} className="card-body">
                <div className="row">
                  <ConnectorIcon id={s.id} name={s.name} iconUrl={s.iconUrl} size={36} className="card-icon" />
                  <span className="name">{s.name}</span>
                  <span className={`kind ${s.kind}`}>{s.kind}</span>
                </div>
                <div className="meta">{s.base}</div>
                <div className="meta" style={{ color: "var(--muted-2)" }}>{s.category}</div>
              </Link>
              <button
                type="button"
                className="connect-btn"
                data-connected={isMine}
                onClick={(e) => { e.preventDefault(); toggle(s); }}
                disabled={isBusy}
                aria-label={isMine ? "Disconnect" : "Add connector"}
                title={isMine ? "Disconnect" : "Add connector"}
              >
                {isBusy ? "…" : isMine ? "✓" : "+"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Show-more pager — appears only when there are more matches than the
          current `shown` window. Keeps initial paint cheap on the full 540-
          server catalog. */}
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
    </div>
  );
}
