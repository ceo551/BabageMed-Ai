"use client";

import React, { useCallback, useEffect, useState } from "react";
import { remoteConnectors, type RemoteConnector } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useUI } from "../lib/ui-context";
import { startRemoteOAuthPopup } from "../lib/oauth";
import { ConnectorIcon } from "../components/ConnectorIcon";

// Curated catalog of official hosted MCP servers (each verified to answer the
// MCP-authz handshake), one-click Connect like Claude. `iconId` maps to the
// ConnectorIcon override table for the official logo; `iconDomain` feeds the
// icon.horse fallback.
const KNOWN: { name: string; url: string; iconId: string; iconDomain: string }[] = [
  { name: "Notion", url: "https://mcp.notion.com/mcp", iconId: "notion", iconDomain: "notion.so" },
  { name: "Gmail", url: "https://gmailmcp.googleapis.com/mcp/v1", iconId: "gmail", iconDomain: "gmail.com" },
  { name: "Google Calendar", url: "https://calendarmcp.googleapis.com/mcp/v1", iconId: "gcalendar", iconDomain: "calendar.google.com" },
  { name: "Google Drive", url: "https://drivemcp.googleapis.com/mcp/v1", iconId: "gdrive", iconDomain: "drive.google.com" },
  { name: "Slack", url: "https://mcp.slack.com/mcp", iconId: "slack", iconDomain: "slack.com" },
  { name: "Linear", url: "https://mcp.linear.app/mcp", iconId: "linear", iconDomain: "linear.app" },
  { name: "GitHub", url: "https://api.githubcopilot.com/mcp/", iconId: "github", iconDomain: "github.com" },
  { name: "Atlassian", url: "https://mcp.atlassian.com/v1/sse", iconId: "atlassian", iconDomain: "atlassian.com" },
  { name: "Sentry", url: "https://mcp.sentry.dev/mcp", iconId: "sentry", iconDomain: "sentry.io" },
  { name: "Asana", url: "https://mcp.asana.com/sse", iconId: "asana", iconDomain: "asana.com" },
  { name: "Canva", url: "https://mcp.canva.com/mcp", iconId: "canva", iconDomain: "canva.com" },
  { name: "Figma", url: "https://mcp.figma.com/mcp", iconId: "figma", iconDomain: "figma.com" },
  { name: "PayPal", url: "https://mcp.paypal.com/mcp", iconId: "paypal", iconDomain: "paypal.com" },
  { name: "Stripe", url: "https://mcp.stripe.com/", iconId: "stripe", iconDomain: "stripe.com" },
  { name: "Square", url: "https://mcp.squareup.com/sse", iconId: "square", iconDomain: "squareup.com" },
  { name: "Intercom", url: "https://mcp.intercom.com/mcp", iconId: "intercom", iconDomain: "intercom.com" },
  { name: "Webflow", url: "https://mcp.webflow.com/sse", iconId: "webflow", iconDomain: "webflow.com" },
  { name: "Vercel", url: "https://mcp.vercel.com", iconId: "vercel", iconDomain: "vercel.com" },
  { name: "Wix", url: "https://mcp.wix.com/sse", iconId: "wix", iconDomain: "wix.com" },
  { name: "Plaid", url: "https://api.dashboard.plaid.com/mcp/sse", iconId: "plaid", iconDomain: "plaid.com" },
  { name: "Hugging Face", url: "https://huggingface.co/mcp", iconId: "huggingface", iconDomain: "huggingface.co" },
];

function hostIcon(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, "").replace(/^mcp\./, ""); }
  catch { return ""; }
}

// RemoteMcpSection — connect external MCP servers via the MCP authorization flow
// (OAuth + dynamic client registration, or a pre-registered client for no-DCR
// providers like Google). One click → sign in at the provider → connected.
export function RemoteMcpSection() {
  const { user } = useAuth();
  const { locale } = useUI();
  const ar = locale === "ar";
  const [mine, setMine] = useState<RemoteConnector[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!user) { setMine([]); return; }
    remoteConnectors.list().then((r) => setMine(r.connectors)).catch(() => {});
  }, [user]);
  useEffect(() => { refresh(); }, [refresh]);

  async function connect(serverUrl: string) {
    if (!user) { window.location.href = "/login"; return; }
    setBusy(serverUrl);
    setErr(null);
    try {
      const r = await startRemoteOAuthPopup(serverUrl);
      if (r.ok) refresh();
      else if (r.error === "popup_blocked") setErr(ar ? "النافذة المنبثقة محظورة — اسمح بها وحاول تاني." : "Popup blocked — allow popups and try again.");
      else if (r.error && r.error !== "cancelled") setErr(ar ? "تعذّر الاتصال بخادم الـ MCP ده." : "Couldn't connect to this MCP server.");
    } catch (e: any) {
      setErr(e?.error || String(e));
    } finally {
      setBusy(null);
    }
  }

  async function remove(c: RemoteConnector) {
    setBusy(c.serverUrl);
    setErr(null);
    try { await remoteConnectors.remove(c.id); refresh(); }
    catch (e: any) { setErr(e?.error || String(e)); }
    finally { setBusy(null); }
  }

  const extra = mine.filter((c) => !KNOWN.some((k) => k.url === c.serverUrl));
  const cards: { key: string; name: string; serverUrl: string; iconId: string; iconDomain: string; conn?: RemoteConnector; removable: boolean }[] = [
    ...KNOWN.map((k) => ({ key: k.url, name: k.name, serverUrl: k.url, iconId: k.iconId, iconDomain: k.iconDomain, conn: mine.find((c) => c.serverUrl === k.url), removable: false })),
    ...extra.map((c) => ({ key: c.id, name: c.name, serverUrl: c.serverUrl, iconId: "", iconDomain: hostIcon(c.serverUrl), conn: c, removable: true })),
  ];

  return (
    <section style={{ margin: "4px 0 28px" }}>
      <div className="mcps-grid">
        {cards.map((c) => {
          const isConnected = !!c.conn?.connected;
          const isBusy = busy === c.serverUrl;
          return (
            <div key={c.key} className="mcp-card" data-connected={isConnected} style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ConnectorIcon id={c.iconId} name={c.name} iconUrl={`https://icon.horse/icon/${c.iconDomain}`} size={30} />
                <span style={{ fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                {isConnected ? (
                  <button
                    className="connect-btn"
                    style={{ width: "auto", padding: "6px 14px", borderRadius: 8, flexShrink: 0 }}
                    disabled={isBusy}
                    onClick={() => remove(c.conn!)}
                  >
                    {isBusy ? "…" : ar ? "فصل" : "Disconnect"}
                  </button>
                ) : (
                  <button
                    className="connect-btn"
                    data-connected
                    style={{ width: "auto", padding: "6px 16px", borderRadius: 8, flexShrink: 0 }}
                    disabled={isBusy}
                    onClick={() => connect(c.serverUrl)}
                  >
                    {isBusy ? "…" : ar ? "ربط" : "Connect"}
                  </button>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                {isConnected && <span className="connected-pill" style={{ flexShrink: 0 }}>{ar ? "✓ متصل" : "✓ Connected"}</span>}
                <span className="meta" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--muted-2)", fontSize: 12 }}>{c.serverUrl}</span>
              </div>
            </div>
          );
        })}
      </div>

      {err && (
        <div role="alert" style={{ marginTop: 12, borderRadius: 10, padding: 10, border: "1px solid var(--error-line)", background: "var(--error-soft)", color: "var(--error)", fontSize: 13 }}>
          {err}
        </div>
      )}
    </section>
  );
}
