"use client";

import React, { useCallback, useEffect, useState } from "react";
import { remoteConnectors, type RemoteConnector } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useUI } from "../lib/ui-context";
import { startRemoteOAuthPopup } from "../lib/oauth";

// Curated catalog of official hosted MCP servers (each verified to answer the
// MCP-authz handshake), pre-seeded so the user connects in one click — sign in
// at the provider, no setup — exactly like Claude's connector directory. Any
// other server can still be added by URL. Icons resolve from the provider
// domain via icon.horse.
const KNOWN: { name: string; url: string; icon: string }[] = [
  { name: "Notion", url: "https://mcp.notion.com/mcp", icon: "notion.so" },
  { name: "Gmail", url: "https://gmailmcp.googleapis.com/mcp/v1", icon: "gmail.com" },
  { name: "Google Calendar", url: "https://calendarmcp.googleapis.com/mcp/v1", icon: "calendar.google.com" },
  { name: "Google Drive", url: "https://drivemcp.googleapis.com/mcp/v1", icon: "drive.google.com" },
  { name: "Slack", url: "https://mcp.slack.com/mcp", icon: "slack.com" },
  { name: "Linear", url: "https://mcp.linear.app/mcp", icon: "linear.app" },
  { name: "GitHub", url: "https://api.githubcopilot.com/mcp/", icon: "github.com" },
  { name: "Atlassian", url: "https://mcp.atlassian.com/v1/sse", icon: "atlassian.com" },
  { name: "Sentry", url: "https://mcp.sentry.dev/mcp", icon: "sentry.io" },
  { name: "Asana", url: "https://mcp.asana.com/sse", icon: "asana.com" },
  { name: "Canva", url: "https://mcp.canva.com/mcp", icon: "canva.com" },
  { name: "Figma", url: "https://mcp.figma.com/mcp", icon: "figma.com" },
  { name: "PayPal", url: "https://mcp.paypal.com/mcp", icon: "paypal.com" },
  { name: "Stripe", url: "https://mcp.stripe.com/", icon: "stripe.com" },
  { name: "Square", url: "https://mcp.squareup.com/sse", icon: "squareup.com" },
  { name: "Intercom", url: "https://mcp.intercom.com/mcp", icon: "intercom.com" },
  { name: "Webflow", url: "https://mcp.webflow.com/sse", icon: "webflow.com" },
  { name: "Vercel", url: "https://mcp.vercel.com", icon: "vercel.com" },
  { name: "Wix", url: "https://mcp.wix.com/sse", icon: "wix.com" },
  { name: "Plaid", url: "https://api.dashboard.plaid.com/mcp/sse", icon: "plaid.com" },
  { name: "Hugging Face", url: "https://huggingface.co/mcp", icon: "huggingface.co" },
];

function hostIcon(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, "").replace(/^mcp\./, ""); }
  catch { return ""; }
}

// RemoteMcpSection — connect external MCP servers via the MCP authorization flow
// (OAuth + dynamic client registration). One click → sign in at the provider →
// connected, with no operator setup.
export function RemoteMcpSection() {
  const { user } = useAuth();
  const { locale } = useUI();
  const [mine, setMine] = useState<RemoteConnector[]>([]);
  const [url, setUrl] = useState("");
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
      if (r.ok) { setUrl(""); refresh(); }
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

  const ar = locale === "ar";
  const extra = mine.filter((c) => !KNOWN.some((k) => k.url === c.serverUrl));
  const cards: { key: string; name: string; serverUrl: string; icon: string; conn?: RemoteConnector; removable: boolean }[] = [
    ...KNOWN.map((k) => ({ key: k.url, name: k.name, serverUrl: k.url, icon: k.icon, conn: mine.find((c) => c.serverUrl === k.url), removable: false })),
    ...extra.map((c) => ({ key: c.id, name: c.name, serverUrl: c.serverUrl, icon: hostIcon(c.serverUrl), conn: c, removable: true })),
  ];

  return (
    <section style={{ margin: "8px 0 28px" }}>
      <h2 style={{ fontSize: 18, margin: "0 0 4px" }}>{ar ? "خوادم MCP بعيدة" : "Remote MCP servers"}</h2>
      <p className="lead" style={{ marginTop: 0 }}>
        {ar
          ? "اربط خادم MCP خارجي (زي Notion) بضغطة واحدة — بتسجّل دخول عند المزوّد، من غير أي إعداد. زي Claude."
          : "Connect an external MCP server (like Notion) in one click — you sign in at the provider, no setup. Works like Claude."}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12, marginTop: 12 }}>
        {cards.map((c) => {
          const isConnected = !!c.conn?.connected;
          const isBusy = busy === c.serverUrl;
          return (
            <div key={c.key} className="mcp-card" data-connected={isConnected} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {c.icon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://icon.horse/icon/${c.icon}`}
                    alt=""
                    width={26}
                    height={26}
                    style={{ borderRadius: 6, flexShrink: 0 }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
                  />
                )}
                <div style={{ fontWeight: 600 }}>{c.name}</div>
              </div>
              <div className="meta" style={{ wordBreak: "break-all", color: "var(--muted-2)" }}>{c.serverUrl}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: "auto" }}>
                {isConnected ? (
                  <>
                    <span className="connected-pill">{ar ? "✓ متصل" : "✓ Connected"}</span>
                    <button className="connect-btn" style={{ width: "auto", padding: "6px 12px", borderRadius: 8 }} disabled={isBusy} onClick={() => remove(c.conn!)}>
                      {ar ? "فصل" : "Disconnect"}
                    </button>
                  </>
                ) : (
                  <>
                    <button className="connect-btn" data-connected style={{ width: "auto", padding: "6px 16px", borderRadius: 8 }} disabled={isBusy} onClick={() => connect(c.serverUrl)}>
                      {isBusy ? "…" : (ar ? "ربط" : "Connect")}
                    </button>
                    {c.removable && (
                      <button className="connect-btn" style={{ width: "auto", padding: "6px 12px", borderRadius: 8 }} disabled={isBusy} onClick={() => remove(c.conn!)}>
                        {ar ? "إزالة" : "Remove"}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); const u = url.trim(); if (u) void connect(u); }} style={{ display: "flex", gap: 8, marginTop: 12, maxWidth: 560 }}>
        <input
          type="url"
          placeholder="https://mcp.example.com/mcp"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "inherit", fontSize: 13 }}
        />
        <button type="submit" className="connect-btn" data-connected style={{ width: "auto", padding: "9px 16px", borderRadius: 8 }} disabled={!url.trim() || !!busy}>
          {ar ? "أضف واربط" : "Add & connect"}
        </button>
      </form>

      {err && (
        <div style={{ marginTop: 10, borderRadius: 10, padding: 10, border: "1px solid var(--purple-line)", background: "var(--purple-soft)", color: "var(--purple)", fontSize: 13 }}>
          {err}
        </div>
      )}
    </section>
  );
}
