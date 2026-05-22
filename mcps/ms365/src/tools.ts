import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
let cached: { v: string; exp: number } | null = null;
async function token() {
  const cid = process.env.MS365_CLIENT_ID;
  const cs = process.env.MS365_CLIENT_SECRET;
  const tid = process.env.MS365_TENANT_ID;
  const rt = process.env.MS365_REFRESH_TOKEN;
  if (!cid || !cs || !tid) throw new Error("MS365_CLIENT_ID/SECRET/TENANT_ID required");
  if (cached && cached.exp > Date.now()) return cached.v;
  const body = new URLSearchParams(rt ? { client_id: cid, client_secret: cs, refresh_token: rt, grant_type: "refresh_token" } : { client_id: cid, client_secret: cs, grant_type: "client_credentials", scope: "https://graph.microsoft.com/.default" });
  const r: any = await fetch(`https://login.microsoftonline.com/${tid}/oauth2/v2.0/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body }).then((r) => r.json());
  cached = { v: r.access_token, exp: Date.now() + (r.expires_in - 60) * 1000 };
  return cached.v;
}
async function client() { return new ApiClient({ base: "https://graph.microsoft.com/v1.0", rps: 3, defaultHeaders: { Authorization: `Bearer ${await token()}` } }); }
export function registerTools(server: McpServer) {
  server.tool({ name: "me", description: "Get current user.", input: z.object({}), handler: async () => (await client()).get<any>("me") });
  server.tool({ name: "mail", description: "List Outlook messages.", input: z.object({ top: z.number().int().min(1).max(100).optional() }), handler: async ({ top = 20 }) => (await client()).get<any>("me/messages", { $top: top }) });
  server.tool({ name: "calendar", description: "List calendar events.", input: z.object({ top: z.number().int().min(1).max(100).optional() }), handler: async ({ top = 20 }) => (await client()).get<any>("me/events", { $top: top }) });
  server.tool({ name: "files", description: "List OneDrive root items.", input: z.object({}), handler: async () => (await client()).get<any>("me/drive/root/children") });
  server.tool({ name: "teams", description: "List Teams the user is a member of.", input: z.object({}), handler: async () => (await client()).get<any>("me/joinedTeams") });
}
