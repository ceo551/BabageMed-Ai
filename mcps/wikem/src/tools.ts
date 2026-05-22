import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "https://wikem.org/w/api.php", rps: 2 });
export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: "MediaWiki opensearch.",
    input: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(30).optional() }),
    handler: async ({ query, limit = 10 }) => {
      const r = await api.get<any>("", { action: "opensearch", search: query, limit, format: "json" });
      const [q, titles, snippets, urls] = r;
      return { query: q, results: (titles || []).map((t: string, i: number) => ({ title: t, snippet: snippets?.[i], url: urls?.[i] })) };
    },
  });
  server.tool({
    name: "page",
    description: "Fetch wiki page wikitext + extract.",
    input: z.object({ title: z.string() }),
    handler: async ({ title }) => api.get<any>("", { action: "query", prop: "extracts|info", explaintext: 1, inprop: "url", titles: title, format: "json" }),
  });
}
