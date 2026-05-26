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
import "../mcps.css";

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
  // OAuth-handoff dialog state — only relevant for api-kind connectors,
  // where the install flow opens the provider's site in a new tab so the
  // user can sign in / authorize.
  const [authOpen, setAuthOpen] = useState(false);
  const [authWindow, setAuthWindow] = useState<Window | null>(null);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState("");

  useEffect(() => {
    if (!id) return;
    mcps.get(id).then(setServer).catch((e: ApiError) => setErr(e.error || String(e)));
  }, [id]);

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
                {new URL(server.siteUrl).hostname} ↗
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
            // api-kind: route through the OAuth-ish key dialog so we can
            // store credentials, not just toggle the row on.
            <button className="primary-btn" onClick={beginApiConnect} disabled={busy}>
              {busy ? "Connecting…" : `Sign in with ${server.siteUrl ? new URL(server.siteUrl).hostname : "provider"}`}
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
          We just opened {server.siteUrl ? <a href={server.siteUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--cyan)" }}>{new URL(server.siteUrl).hostname}</a> : "the provider site"} in a new tab.
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
