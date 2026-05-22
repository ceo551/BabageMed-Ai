import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils", rps: 3 });
const KEY = process.env.NCBI_API_KEY;
function base() { const q: Record<string,string> = { tool: "BabageMedAI", email: process.env.NCBI_EMAIL || "ceo@babagemed.com", db: "books", retmode: "json" }; if (KEY) q.api_key = KEY; return q; }
export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: "Search Endotext (NCBI Bookshelf, NBK279071) by topic.",
    input: z.object({ term: z.string().min(1), retmax: z.number().int().min(1).max(100).optional() }),
    handler: async ({ term, retmax = 20 }) => {
      const r = await api.get<any>("esearch.fcgi", { ...base(), term: `${term} AND endotext[book]`, retmax });
      return { ids: r?.esearchresult?.idlist ?? [], count: Number(r?.esearchresult?.count || 0) };
    },
  });
  server.tool({
    name: "chapter",
    description: "Fetch chapter metadata by Bookshelf ID.",
    input: z.object({ id: z.string() }),
    handler: async ({ id }) => api.get<any>("esummary.fcgi", { ...base(), id }),
  });
}
