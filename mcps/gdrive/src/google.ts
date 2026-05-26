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
    cachedToken = null;
    throw new Error(`google token refresh ${res.status}`);
  }
  const r = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!r.access_token) {
    cachedToken = null;
    throw new Error(`google token: ${r.error || "no access_token"}`);
  }
  const ttl = Math.min(3600, Math.max(120, r.expires_in ?? 3600));
  cachedToken = { value: r.access_token, exp: Date.now() + (ttl - 60) * 1000 };
  return cachedToken.value;
}

export function invalidateGoogleAccessToken() {
  cachedToken = null;
}
