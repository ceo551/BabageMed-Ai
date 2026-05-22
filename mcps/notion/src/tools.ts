import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const TOKEN = process.env.NOTION_TOKEN || "";
const api = new ApiClient({
  base: "https://api.notion.com/v1",
  rps: 3,
  defaultHeaders: { Authorization: `Bearer ${TOKEN}`, "Notion-Version": "2022-06-28" },
});
function need() { if (!TOKEN) throw new Error("NOTION_TOKEN not configured"); }
export function registerTools(server: McpServer) {
  server.tool({ name: "search", description: "Search Notion workspace.", input: z.object({ query: z.string() }), handler: async ({ query }) => { need(); return api.post<any>("search", { query, page_size: 20 }); } });
  server.tool({ name: "page", description: "Fetch a Notion page.", input: z.object({ id: z.string() }), handler: async ({ id }) => { need(); return api.get<any>(`pages/${id}`); } });
  server.tool({ name: "database", description: "Query a Notion database.", input: z.object({ id: z.string(), filter: z.unknown().optional() }), handler: async ({ id, filter }) => { need(); return api.post<any>(`databases/${id}/query`, filter ? { filter } : {}); } });
  server.tool({ name: "create", description: "Create a page under a parent (page or database).", input: z.object({ parent: z.object({ database_id: z.string().optional(), page_id: z.string().optional() }), properties: z.unknown(), children: z.unknown().optional() }), handler: async (b) => { need(); return api.post<any>("pages", b); } });
}
