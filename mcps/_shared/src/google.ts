// Shared Google OAuth helper. Imported by mcps/gmail, mcps/gcalendar, and
// mcps/gdrive via the relative path "../../_shared/src/google.js" (each
// MCP's Dockerfile copies _shared into /build/mcps/_shared).
//
// Holds a process-wide bearer token cache + automatic refresh on 401.
// The cache must invalidate on revocation — otherwise a revoked refresh
// token sits in memory and every request is retried indefinitely.

let cachedToken: { value: string; exp: number } | null = null;

export async function googleAccessToken(): Promise<string> {
  const cid = process.env.GOOGLE_CLIENT_ID;
  const cs = process.env.GOOGLE_CLIENT_SECRET;
  const rt = process.env.GOOGLE_REFRESH_TOKEN;
  if (!cid || !cs || !rt) throw new Error("GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN required");
  if (cachedToken && cachedToken.exp > Date.now()) return cachedToken.value;
  const body = new URLSearchParams({ client_id: cid, client_secret: cs, refresh_token: rt, grant_type: "refresh_token" });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    // Clear the cache on hard failure so the next call retries cleanly.
    cachedToken = null;
    throw new Error(`google token refresh ${res.status}`);
  }
  const r = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!r.access_token) {
    cachedToken = null;
    throw new Error(`google token: ${r.error || "no access_token"}`);
  }
  // Clamp expires_in into [120s, 1h] so a malformed 0 doesn't expire the
  // token immediately and force a refresh on every subsequent call.
  const ttl = Math.min(3600, Math.max(120, r.expires_in ?? 3600));
  cachedToken = { value: r.access_token, exp: Date.now() + (ttl - 60) * 1000 };
  return cachedToken.value;
}

/** Forget the cached token — call when a downstream API returns 401. */
export function invalidateGoogleAccessToken() {
  cachedToken = null;
}
