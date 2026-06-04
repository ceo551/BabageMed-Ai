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
import { Modal } from "../components/Modal";
import { startOAuthPopup } from "../lib/oauth";
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
  // The connector pending a connect dialog (for an optional per-user token).
  const [pending, setPending] = useState<McpServer | null>(null);
  const [token, setToken] = useState("");
  // Connector ids with a real OAuth flow configured → Connect opens the popup.
  const [oauthIds, setOauthIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    connectorsApi.oauthProviders()
      .then((r) => setOauthIds(new Set(r.providers)))
      .catch(() => {});
  }, []);
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

  // Connecting opens a dialog for an optional per-user credential; disconnecting
  // is immediate.
  function toggle(srv: McpServer) {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    if (mine[srv.id]) {
      void disconnect(srv);
    } else if (oauthIds.has(srv.id)) {
      void oauthConnect(srv);
    } else {
      setToken("");
      setPending(srv);
    }
  }

  // Real OAuth: open the provider sign-in popup, then refresh on success.
  async function oauthConnect(srv: McpServer) {
    setBusy(srv.id);
    setError(null);
    try {
      const r = await startOAuthPopup(srv.id);
      if (r.ok) {
        const all = await connectorsApi.list();
        setMine(Object.fromEntries(all.map((c) => [c.mcpId, c])));
      } else if (r.error === "popup_blocked") {
        setError("Popup blocked — allow popups for this site and try again.");
      } else if (r.error && r.error !== "cancelled") {
        setError("Sign-in didn't complete. Please try again.");
      }
    } catch (e: any) {
      setError(e?.error || String(e));
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(srv: McpServer) {
    setBusy(srv.id);
    try {
      await connectorsApi.disconnect(srv.id);
      setMine((m) => {
        const next = { ...m };
        delete next[srv.id];
        return next;
      });
    } catch (e: any) {
      setError(e?.error || String(e));
    } finally {
      setBusy(null);
    }
  }

  async function confirmConnect() {
    const srv = pending;
    if (!srv) return;
    setBusy(srv.id);
    try {
      const tok = token.trim();
      const c = await connectorsApi.connect(srv.id, tok ? { token: tok } : {});
      setMine((m) => ({ ...m, [srv.id]: c }));
      setPending(null);
      setToken("");
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

      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title={pending ? `${locale === "ar" ? "ربط" : "Connect"} ${pending.name}` : ""}
        width={460}
      >
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0, lineHeight: 1.6 }}>
          {locale === "ar"
            ? "ألصق التوكن الخاص بك لهذا الموصِّل (اختياري) عشان المساعد يتصرّف باسمك. لو سِبته فاضي، هيُستخدم إعداد المساحة المشترك."
            : "Paste your own access token / API key for this connector (optional) so the assistant acts as you. Leave it blank to use the shared workspace setup."}
        </p>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={locale === "ar" ? "التوكن (اختياري)" : "Access token (optional)"}
          autoComplete="off"
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "inherit", fontSize: 13 }}
          onKeyDown={(e) => { if (e.key === "Enter") void confirmConnect(); }}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button
            type="button"
            className="connect-btn"
            style={{ width: "auto", padding: "8px 16px", borderRadius: 8 }}
            onClick={() => setPending(null)}
          >
            {locale === "ar" ? "إلغاء" : "Cancel"}
          </button>
          <button
            type="button"
            className="connect-btn"
            data-connected
            style={{ width: "auto", padding: "8px 18px", borderRadius: 8 }}
            disabled={!!busy}
            onClick={() => void confirmConnect()}
          >
            {busy ? "…" : locale === "ar" ? "ربط" : "Connect"}
          </button>
        </div>
      </Modal>
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
