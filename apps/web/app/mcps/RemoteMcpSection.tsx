"use client";

import React, { useCallback, useEffect, useState } from "react";
import { remoteConnectors, type RemoteConnector } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useUI } from "../lib/ui-context";
import { startRemoteOAuthPopup } from "../lib/oauth";

// Known hosted MCP servers we pre-seed so the user can connect in one click,
// the way Claude lists Notion etc. Any other server can be added by URL.
const KNOWN: { name: string; url: string }[] = [
  { name: "Notion", url: "https://mcp.notion.com/mcp" },
];

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
  const cards: { key: string; name: string; serverUrl: string; conn?: RemoteConnector; removable: boolean }[] = [
    ...KNOWN.map((k) => ({ key: k.url, name: k.name, serverUrl: k.url, conn: mine.find((c) => c.serverUrl === k.url), removable: false })),
    ...extra.map((c) => ({ key: c.id, name: c.name, serverUrl: c.serverUrl, conn: c, removable: true })),
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
              <div style={{ fontWeight: 600 }}>{c.name}</div>
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
