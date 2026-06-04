// Connector OAuth — the "Connect → sign in at the provider → connected" flow.
// We open a popup straight at the backend start endpoint (which 302-redirects to
// the provider through the proxy), then wait for the callback page to postMessage
// back its result and close. Resolves false if the user closes the popup or it's
// blocked.

export type OAuthResult = { ok: boolean; error?: string };

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
