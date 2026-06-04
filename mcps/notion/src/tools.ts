// @hand-edited — do not regenerate via write-real-tools.mjs
import { z, McpServer, ApiClient } from "@pervagans/mcp-base";

// Shared env token — the workspace-wide fallback used when a user hasn't
// connected Notion with their own integration token.
const TOKEN = process.env.NOTION_TOKEN || "";

// The shared client carries only the Notion-Version header; Authorization is
// attached PER REQUEST so a per-user credential (ctx.credential, forwarded by
// the backend as X-MCP-Credential) takes precedence over the env token. The
// ApiClient already folds Authorization into its cache key, so two users'
// tokens never share a cached response.
const api = new ApiClient({
  base: "https://api.notion.com/v1",
  rps: 3,
  defaultHeaders: { "Notion-Version": "2022-06-28" },
});

// authHeaders resolves the upstream Authorization for this call: the connecting
// user's own token if present, else the shared env token. Throws if neither is
// configured so the model gets a clear "connect Notion" signal, not a raw 401.
function authHeaders(ctx: { credential?: string }): Record<string, string> {
  const token = (ctx.credential || TOKEN).trim();
  if (!token) throw new Error("Notion not configured: connect Notion with your integration token");
  return { Authorization: `Bearer ${token}` };
}

// Notion IDs are 32-char hex (with or without dashes).
const notionIdSchema = z.string().regex(/^[0-9a-f]{32}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: "Search Notion workspace.",
    input: z.object({ query: z.string().min(1).max(256) }),
    handler: async ({ query }, ctx) => api.post<any>("search", { query, page_size: 20 }, { headers: authHeaders(ctx) }),
  });
  server.tool({
    name: "page",
    description: "Fetch a Notion page.",
    input: z.object({ id: notionIdSchema }),
    handler: async ({ id }, ctx) => api.get<any>(`pages/${encodeURIComponent(id)}`, undefined, { headers: authHeaders(ctx) }),
  });
  server.tool({
    name: "database",
    description: "Query a Notion database.",
    input: z.object({ id: notionIdSchema, filter: z.unknown().optional() }),
    handler: async ({ id, filter }, ctx) => api.post<any>(`databases/${encodeURIComponent(id)}/query`, filter ? { filter } : {}, { headers: authHeaders(ctx) }),
  });
  server.tool({
    name: "create",
    description: "Create a page under a parent (database OR page, not both).",
    // .refine ensures exactly one parent kind is set; previously a body
    // with neither yielded a misleading 400 from Notion.
    input: z.object({
      parent: z.object({ database_id: notionIdSchema.optional(), page_id: notionIdSchema.optional() })
        .refine((p) => Boolean(p.database_id) !== Boolean(p.page_id), {
          message: "parent must be exactly one of database_id or page_id",
        }),
      properties: z.unknown(),
      children: z.unknown().optional(),
    }),
    handler: async (b, ctx) => api.post<any>("pages", b, { headers: authHeaders(ctx) }),
  });
}
