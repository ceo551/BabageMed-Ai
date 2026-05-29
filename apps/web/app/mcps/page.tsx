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
import { useUI } from "../lib/ui-context";
import { ConnectorIcon } from "../components/ConnectorIcon";
import "./mcps.css";

// "Connectors" directory (mounted at /mcps for backwards-compatible URLs).
// One flat grid of every connector — no feature/kind filtering, no
// per-feature grouping. Each card shows the provider's favicon, kind, and a
// "+" button to install in one click ("✓" when connected).
const PAGE_SIZE = 60;

export default function ConnectorsBrowsePage() {
  const { user } = useAuth();
  const { s, locale } = useUI();
  const [all, setAll] = useState<McpServer[]>([]);
  const [mine, setMine] = useState<Record<string, Connector>>({});
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [shown, setShown] = useState<number>(PAGE_SIZE);
  // Reset pagination whenever the search changes so the user always sees the
  // top of the result set after typing.
  useEffect(() => { setShown(PAGE_SIZE); }, [q]);

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
    if (!needle) return all;
    return all.filter((srv) =>
      srv.id.toLowerCase().includes(needle) ||
      srv.name.toLowerCase().includes(needle) ||
      srv.base.toLowerCase().includes(needle)
    );
  }, [all, q]);

  async function toggle(srv: McpServer) {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    setBusy(srv.id);
    try {
      if (mine[srv.id]) {
        await connectorsApi.disconnect(srv.id);
        setMine((m) => {
          const next = { ...m };
          delete next[srv.id];
          return next;
        });
      } else {
        const c = await connectorsApi.connect(srv.id);
        setMine((m) => ({ ...m, [srv.id]: c }));
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

      {!error && all.length === 0 ? (
        <div className="mcps-empty">{s.loadingChats}</div>
      ) : !error && filtered.length === 0 ? (
        <div className="mcps-empty">
          <p>{locale === "ar" ? "لا توجد أدوات مطابقة لبحثك." : "No connectors match your search."}</p>
          {q && (
            <button
              type="button"
              className="connect-btn"
              style={{ padding: "8px 18px", borderRadius: 999, marginTop: 12, width: "auto" }}
              onClick={() => setQ("")}
            >
              {locale === "ar" ? "مسح البحث" : "Clear search"}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="mcps-grid">
            {filtered.slice(0, shown).map((srv) => (
              <ConnectorCard
                key={srv.id}
                server={srv}
                isMine={!!mine[srv.id]}
                isBusy={busy === srv.id}
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

// ── Shared card renderer.
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
      >
        {isBusy ? "…" : isMine ? "✓" : "+"}
      </button>
    </div>
  );
}
