"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  mcps,
  connectors as connectorsApi,
  type McpServer,
  type Connector,
  type ApiError,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { ConnectorIcon } from "../../components/ConnectorIcon";
import { Modal } from "../../components/Modal";
import { startOAuthPopup } from "../../lib/oauth";
import "../mcps.css";

// new URL(server.siteUrl) throws synchronously during render if siteUrl is
// relative or malformed (the value is backend-controlled and only checked
// for truthiness), which crashes the whole page into the ErrorBoundary.
// safeHostname try/catches and falls back to the raw string so a bad
// siteUrl degrades to plain text instead of a blank crash card.
function safeHostname(u: string | undefined | null): string {
  if (!u) return "";
  try {
    return new URL(u).hostname;
  } catch {
    return u;
  }
}

// Connector detail page — Claude-style one-click connect.
//
// For scrape-kind MCPs we hit POST /api/connectors/{id} and we're done.
// For api-kind MCPs we still register the connector (so the chat layer can
// use it for retrieval), and additionally surface the provider's official
// site so the user can finish credentials there if needed.
//
// The earlier per-tool tester form (search / fetch / summary / related) was
// removed in favour of this single Connect/Open-site flow.
export default function McpDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const [server, setServer] = useState<McpServer | null>(null);
  const [connector, setConnector] = useState<Connector | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // (OAuth-handoff dialog state for api-kind connectors was sketched
  // here but never wired into the render path — removed by round 27
  // verify pass. Re-add when the provider-OAuth flow lands.)
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  // Whether this connector has a real OAuth flow configured on the backend.
  const [oauthAvailable, setOauthAvailable] = useState(false);

  useEffect(() => {
    if (!id) return;
    mcps.get(id).then(setServer).catch((e: ApiError) => setErr(e.error || String(e)));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    connectorsApi.oauthProviders()
      .then((r) => setOauthAvailable(r.providers.includes(id)))
      .catch(() => setOauthAvailable(false));
  }, [id]);

  // Real OAuth connect: open the provider sign-in popup, then refresh on success.
  async function oauthConnect() {
    if (!id || !user) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await startOAuthPopup(id);
      if (r.ok) {
        const all = await connectorsApi.list();
        setConnector(all.find((c) => c.mcpId === id) || null);
      } else if (r.error === "popup_blocked") {
        setErr("Popup blocked — allow popups for this site and try again.");
      } else if (r.error && r.error !== "cancelled") {
        setErr("Sign-in didn't complete. Please try again.");
      }
    } catch (e: any) {
      setErr(e?.error || String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (loading || !user || !id) return;
    connectorsApi
      .list()
      .then((all) => setConnector(all.find((c) => c.mcpId === id) || null))
      .catch(() => setConnector(null));
  }, [loading, user, id]);

  // Plain connect — used for scrape-kind connectors that need no credential.
  async function connect(config?: Record<string, unknown>) {
    if (!id || !user) return;
    setBusy(true);
    setErr(null);
    try {
      const c = await connectorsApi.connect(id, config);
      setConnector(c);
    } catch (e: any) {
      setErr(e?.error || String(e));
    } finally {
      setBusy(false);
    }
  }

  // api-kind connectors: bounce the user to the provider site (new tab) to
  // pick up an API key, then ask them to paste it back. The key is stored
  // in user_connectors.config so future chat requests can attach it.
  function beginApiConnect() {
    if (server?.siteUrl) {
      window.open(server.siteUrl, "_blank", "noopener,noreferrer");
    }
    setApiKeyDraft("");
    setKeyModalOpen(true);
  }
  async function submitApiKey(skip: boolean) {
    setKeyModalOpen(false);
    const trimmed = apiKeyDraft.trim();
    // Wipe the draft from React state as soon as the submit is in flight
    // so React DevTools / heap snapshots don't capture the plaintext key
    // longer than necessary. The trimmed value lives only in this closure.
    setApiKeyDraft("");
    if (skip || !trimmed) {
      // User chose to connect without a key — still useful for read-only
      // public APIs (PubMed, openFDA, etc) that work unauthenticated.
      return connect();
    }
    return connect({ apiKey: trimmed });
  }

  async function disconnect() {
    if (!id) return;
    setBusy(true);
    setErr(null);
    try {
      await connectorsApi.disconnect(id);
      setConnector(null);
    } catch (e: any) {
      setErr(e?.error || String(e));
    } finally {
      setBusy(false);
    }
  }

  if (err && !server) {
    return (
      <div className="mcps-shell">
        <Link href="/mcps" style={{ color: "var(--cyan)" }}>← Connectors</Link>
        <div
          style={{
            borderRadius: 10,
            padding: 12,
            border: "1px solid var(--purple-line)",
            background: "var(--purple-soft)",
            color: "var(--purple)",
          }}
        >
          {err}
        </div>
      </div>
    );
  }
  if (!server) return <div className="mcps-shell"><p className="lead">Loading…</p></div>;

  const isApi = server.kind === "api" || server.kind === "hybrid";
  const connected = !!connector;

  return (
    <div className="mcps-shell mcp-detail">
      <div className="breadcrumb"><Link href="/mcps">Connectors</Link> / {server.id}</div>

      <div className="connector-header">
        <ConnectorIcon id={server.id} name={server.name} iconUrl={server.iconUrl} size={56} className="connector-icon" />
        <div className="connector-meta">
          <h1>{server.name}</h1>
          <div className="row">
            <span className={`kind ${server.kind}`}>{server.kind}</span>
            <span className="port">port {server.port}</span>
            {server.siteUrl && (
              <a className="site" href={server.siteUrl} target="_blank" rel="noopener noreferrer">
                {safeHostname(server.siteUrl)} ↗
              </a>
            )}
          </div>
          <code className="base">{server.base}</code>
        </div>
      </div>

      <p className="lead">
        {isApi
          ? "This connector calls the provider's official API. After connecting, you may also want to set credentials on the provider's site (open it below)."
          : "This connector scrapes the official site in real time, respecting robots.txt. Add it and we'll route relevant queries through it."}
      </p>

      {!user ? (
        <div className="connector-cta">
          <span style={{ color: "var(--muted)" }}>Sign in to add this connector to your workspace.</span>
          <Link href="/login" className="primary-btn">Sign in</Link>
        </div>
      ) : (
        <div className="connector-cta">
          {connected ? (
            <>
              <span className="connected-pill">✓ Connected</span>
              <button className="ghost-btn" onClick={disconnect} disabled={busy}>
                {busy ? "Removing…" : "Disconnect"}
              </button>
            </>
          ) : isApi ? (
            // api-kind: real OAuth popup when the provider is configured,
            // otherwise the paste-a-token dialog so we can still store a key.
            <button className="primary-btn" onClick={oauthAvailable ? oauthConnect : beginApiConnect} disabled={busy}>
              {busy ? "Connecting…" : `Sign in with ${server.siteUrl ? safeHostname(server.siteUrl) : "provider"}`}
            </button>
          ) : (
            <button className="primary-btn" onClick={() => connect()} disabled={busy}>
              {busy ? "Connecting…" : "+ Add connector"}
            </button>
          )}
          {isApi && server.siteUrl && !connected && (
            <a className="ghost-btn" href={server.siteUrl} target="_blank" rel="noopener noreferrer">
              Open provider site ↗
            </a>
          )}
        </div>
      )}

      {err && (
        <div
          style={{
            borderRadius: 10,
            padding: 10,
            border: "1px solid var(--purple-line)",
            background: "var(--purple-soft)",
            color: "var(--purple)",
          }}
        >
          {err}
        </div>
      )}

      {/* API-key dialog for api-kind connectors. */}
      <Modal
        open={keyModalOpen}
        onClose={() => setKeyModalOpen(false)}
        title={`Connect ${server.name}`}
        width={520}
      >
        <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>
          We just opened {server.siteUrl ? <a href={server.siteUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--cyan)" }}>{safeHostname(server.siteUrl)}</a> : "the provider site"} in a new tab.
          Sign in there and copy your API key / personal access token, then paste it below — we'll attach it to chat requests routed through this connector.
        </p>
        <label className="field-label" htmlFor="ak">API key / token <span className="optional">(optional)</span></label>
        <input
          id="ak"
          type="password"
          className="field-input"
          placeholder="paste here"
          value={apiKeyDraft}
          onChange={(e) => setApiKeyDraft(e.target.value)}
          autoFocus
          autoComplete="off"
          spellCheck={false}
        />
        <p style={{ color: "var(--muted-2)", fontSize: 12, marginTop: 8 }}>
          Stored encrypted-at-rest in your user_connectors row; never logged. You can clear it any time by disconnecting + reconnecting.
        </p>
        <div className="new-space-actions" style={{ marginTop: 14 }}>
          <button type="button" className="ghost-btn" onClick={() => submitApiKey(true)} disabled={busy}>
            Connect without key
          </button>
          <button type="button" className="primary-btn" onClick={() => submitApiKey(false)} disabled={busy}>
            {busy ? "Connecting…" : apiKeyDraft.trim() ? "Save & connect" : "Connect"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
