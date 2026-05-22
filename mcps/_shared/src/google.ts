let cachedToken: { value: string; exp: number } | null = null;
export async function googleAccessToken(): Promise<string> {
  const cid = process.env.GOOGLE_CLIENT_ID;
  const cs = process.env.GOOGLE_CLIENT_SECRET;
  const rt = process.env.GOOGLE_REFRESH_TOKEN;
  if (!cid || !cs || !rt) throw new Error("GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN required");
  if (cachedToken && cachedToken.exp > Date.now()) return cachedToken.value;
  const body = new URLSearchParams({ client_id: cid, client_secret: cs, refresh_token: rt, grant_type: "refresh_token" });
  const r: any = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body }).then((r) => r.json());
  cachedToken = { value: r.access_token, exp: Date.now() + (r.expires_in - 60) * 1000 };
  return cachedToken.value;
}
