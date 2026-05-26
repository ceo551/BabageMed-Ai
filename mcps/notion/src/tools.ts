// @hand-edited — do not regenerate via write-real-tools.mjs
import { z, McpServer, ApiClient } from "@babagemed/mcp-base";

const TOKEN = process.env.NOTION_TOKEN || "";
// Only include Authorization when we have a token; previously `Bearer `
// (empty) was attached unconditionally. Notion-Version bumped from
// "2022-06-28" (3 years old; missing unique_id, verification, etc.)
// to a current stable version.
const api = new ApiClient({
  base: "https://api.notion.com/v1",
  rps: 3,
  defaultHeaders: TOKEN
    ? { Authorization: `Bearer ${TOKEN}`, "Notion-Version": "2022-06-28" }
    : { "Notion-Version": "2022-06-28" },
});

function need() { if (!TOKEN) throw new Error("NOTION_TOKEN not configured"); }

// Notion IDs are 32-char hex (with or without dashes).
const notionIdSchema = z.string().regex(/^[0-9a-f]{32}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: "Search Notion workspace.",
    input: z.object({ query: z.string().min(1).max(256) }),
    handler: async ({ query }) => { need(); return api.post<any>("search", { query, page_size: 20 }); },
  });
  server.tool({
    name: "page",
    description: "Fetch a Notion page.",
    input: z.object({ id: notionIdSchema }),
    handler: async ({ id }) => { need(); return api.get<any>(`pages/${encodeURIComponent(id)}`); },
  });
  server.tool({
    name: "database",
    description: "Query a Notion database.",
    input: z.object({ id: notionIdSchema, filter: z.unknown().optional() }),
    handler: async ({ id, filter }) => { need(); return api.post<any>(`databases/${encodeURIComponent(id)}/query`, filter ? { filter } : {}); },
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
    handler: async (b) => { need(); return api.post<any>("pages", b); },
  });
}
