// @hand-edited — do not regenerate via write-real-tools.mjs
import { z, McpServer, ApiClient } from "@babagemed/mcp-base";

let cached: { v: string; exp: number } | null = null;

async function token(): Promise<string> {
  const cid = process.env.MS365_CLIENT_ID;
  const cs = process.env.MS365_CLIENT_SECRET;
  const tid = process.env.MS365_TENANT_ID;
  const rt = process.env.MS365_REFRESH_TOKEN;
  if (!cid || !cs || !tid) throw new Error("MS365_CLIENT_ID/SECRET/TENANT_ID required");
  if (cached && cached.exp > Date.now()) return cached.v;

  const body = new URLSearchParams(
    rt
      ? { client_id: cid, client_secret: cs, refresh_token: rt, grant_type: "refresh_token" }
      : { client_id: cid, client_secret: cs, grant_type: "client_credentials", scope: "https://graph.microsoft.com/.default" },
  );
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tid)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  // CRITICAL: validate before caching. Without these checks an Azure AD
  // 400 (e.g. invalid_client) made cached.exp = NaN and every subsequent
  // tool call sent `Bearer undefined` because the poisoned entry passed
  // the (cached && cached.exp > Date.now()) test never (NaN > x is
  // false), causing every call to re-fetch the failing token.
  if (!res.ok) {
    cached = null;
    const text = await res.text();
    throw new Error(`MS365 token ${res.status}: ${text.slice(0, 200)}`);
  }
  const r = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!r.access_token) {
    cached = null;
    throw new Error("MS365 token response missing access_token");
  }
  // Clamp expires_in to a sane range so a malformed 0 doesn't make the
  // cache expire immediately and force a refresh on every call.
  const ttl = Math.min(86400, Math.max(120, r.expires_in ?? 3600));
  cached = { v: r.access_token, exp: Date.now() + (ttl - 60) * 1000 };
  return cached.v;
}

// Lazy, persistent client. The previous `new ApiClient(...)` per call
// reset nextSlot to 0 (bypassing the rps:3 throttle) and made the cache
// always miss — identical bug to the one already fixed in gmail/gdrive/
// gcalendar.
let _client: ApiClient | null = null;
async function client(): Promise<ApiClient> {
  if (!_client) _client = new ApiClient({ base: "https://graph.microsoft.com/v1.0", rps: 3 });
  const t = await token();
  (_client as unknown as { opts: { defaultHeaders: Record<string, string> } }).opts.defaultHeaders = {
    Authorization: `Bearer ${t}`,
  };
  return _client;
}

export function registerTools(server: McpServer) {
  server.tool({ name: "me", description: "Get current user.", input: z.object({}), handler: async () => (await client()).get<any>("me") });
  server.tool({ name: "mail", description: "List Outlook messages.", input: z.object({ top: z.number().int().min(1).max(100).optional() }), handler: async ({ top = 20 }) => (await client()).get<any>("me/messages", { $top: top }) });
  server.tool({ name: "calendar", description: "List calendar events.", input: z.object({ top: z.number().int().min(1).max(100).optional() }), handler: async ({ top = 20 }) => (await client()).get<any>("me/events", { $top: top }) });
  server.tool({ name: "files", description: "List OneDrive root items.", input: z.object({}), handler: async () => (await client()).get<any>("me/drive/root/children") });
  server.tool({ name: "teams", description: "List Teams the user is a member of.", input: z.object({}), handler: async () => (await client()).get<any>("me/joinedTeams") });
}
