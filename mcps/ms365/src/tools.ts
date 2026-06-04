// @hand-edited — do not regenerate via write-real-tools.mjs
import { z, McpServer, ApiClient } from "@pervagans/mcp-base";

let cached: { v: string; exp: number } | null = null;

// Shared env token flow (client_credentials / refresh-token) — the fallback
// used when a user hasn't connected MS365 with their own account.
async function envToken(): Promise<string> {
  const cid = process.env.MS365_CLIENT_ID;
  const cs = process.env.MS365_CLIENT_SECRET;
  const tid = process.env.MS365_TENANT_ID;
  const rt = process.env.MS365_REFRESH_TOKEN;
  if (!cid || !cs || !tid) throw new Error("MS365 not configured: connect with your account");
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
  // tool call sent `Bearer undefined`.
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
  const ttl = Math.min(86400, Math.max(120, r.expires_in ?? 3600));
  cached = { v: r.access_token, exp: Date.now() + (ttl - 60) * 1000 };
  return cached.v;
}

// Lazy, persistent client. Auth is attached per request (graphAuth), not baked
// onto the shared client (a race across concurrent per-user requests).
let _client: ApiClient | null = null;
function client(): ApiClient {
  if (!_client) _client = new ApiClient({ base: "https://graph.microsoft.com/v1.0", rps: 3 });
  return _client;
}
// Per-call auth: the user's own access token (ctx.credential, forwarded as
// X-MCP-Credential) if present, else the shared env token flow.
async function graphAuth(ctx: { credential?: string }): Promise<Record<string, string>> {
  const t = ctx.credential || (await envToken());
  return { Authorization: `Bearer ${t}` };
}

export function registerTools(server: McpServer) {
  server.tool({ name: "me", description: "Get current user.", input: z.object({}), handler: async (_i, ctx) => client().get<any>("me", undefined, { headers: await graphAuth(ctx) }) });
  server.tool({ name: "mail", description: "List Outlook messages.", input: z.object({ top: z.number().int().min(1).max(100).optional() }), handler: async ({ top = 20 }, ctx) => client().get<any>("me/messages", { $top: top }, { headers: await graphAuth(ctx) }) });
  server.tool({ name: "calendar", description: "List calendar events.", input: z.object({ top: z.number().int().min(1).max(100).optional() }), handler: async ({ top = 20 }, ctx) => client().get<any>("me/events", { $top: top }, { headers: await graphAuth(ctx) }) });
  server.tool({ name: "files", description: "List OneDrive root items.", input: z.object({}), handler: async (_i, ctx) => client().get<any>("me/drive/root/children", undefined, { headers: await graphAuth(ctx) }) });
  server.tool({ name: "teams", description: "List Teams the user is a member of.", input: z.object({}), handler: async (_i, ctx) => client().get<any>("me/joinedTeams", undefined, { headers: await graphAuth(ctx) }) });
}
