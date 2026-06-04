// Connector OAuth — the "Connect → sign in at the provider → connected" flow.
// We open a popup straight at the backend start endpoint (which 302-redirects to
// the provider through the proxy), then wait for the callback page to postMessage
// back its result and close. Resolves false if the user closes the popup or it's
// blocked.

export type OAuthResult = { ok: boolean; error?: string };

function centeredPopupFeatures(w: number, h: number): string {
  const y = window.top ? window.top.outerHeight / 2 + window.top.screenY - h / 2 : 0;
  const x = window.top ? window.top.outerWidth / 2 + window.top.screenX - w / 2 : 0;
  return `popup,width=${w},height=${h},left=${x},top=${y}`;
}

// Await the callback page's postMessage for a given flow id, resolving false if
// the popup is closed first.
function awaitOAuthMessage(popup: Window, id: string): Promise<OAuthResult> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    function finish(r: OAuthResult) {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMsg);
      if (timer) clearInterval(timer);
      resolve(r);
    }
    function onMsg(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { type?: string; mcpId?: string; ok?: boolean } | null;
      if (d && d.type === "pervagans-oauth" && d.mcpId === id) finish({ ok: !!d.ok });
    }
    window.addEventListener("message", onMsg);
    timer = setInterval(() => { if (popup.closed) finish({ ok: false, error: "cancelled" }); }, 700);
  });
}

// Remote MCP connect: open a popup, ask the backend to discover OAuth + register
// a client dynamically, then point the popup at the provider sign-in. Resolves
// when the callback page signals back.
export async function startRemoteOAuthPopup(url: string): Promise<OAuthResult> {
  const popup = window.open("", "pervagans-oauth", centeredPopupFeatures(600, 760));
  if (!popup) return { ok: false, error: "popup_blocked" };
  let id = "";
  let authorizeUrl = "";
  try {
    const { remoteConnectors } = await import("./api");
    const r = await remoteConnectors.add(url);
    id = r.id;
    authorizeUrl = r.authorizeUrl;
  } catch (e: any) {
    try { popup.close(); } catch { /* ignore */ }
    return { ok: false, error: e?.error || "discover_failed" };
  }
  popup.location.href = authorizeUrl;
  return awaitOAuthMessage(popup, id);
}

export function startOAuthPopup(mcpId: string): Promise<OAuthResult> {
  return new Promise((resolve) => {
    const url = `/api/backend/api/connectors/${encodeURIComponent(mcpId)}/oauth/start`;
    const w = 600;
    const h = 760;
    // Center the popup over the current window.
    const y = window.top ? window.top.outerHeight / 2 + window.top.screenY - h / 2 : 0;
    const x = window.top ? window.top.outerWidth / 2 + window.top.screenX - w / 2 : 0;
    const popup = window.open(url, "pervagans-oauth", `popup,width=${w},height=${h},left=${x},top=${y}`);

    let settled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    function finish(r: OAuthResult) {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMsg);
      if (timer) clearInterval(timer);
      resolve(r);
    }
    function onMsg(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { type?: string; mcpId?: string; ok?: boolean } | null;
      if (d && d.type === "pervagans-oauth" && d.mcpId === mcpId) {
        finish({ ok: !!d.ok });
      }
    }
    window.addEventListener("message", onMsg);

    if (!popup) {
      finish({ ok: false, error: "popup_blocked" });
      return;
    }
    // Poll for the user closing the popup without finishing.
    timer = setInterval(() => {
      if (popup.closed) finish({ ok: false, error: "cancelled" });
    }, 700);
  });
}
