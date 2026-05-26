// @generated-by write-real-tools.mjs (preserved by generate-mcps.mjs)
import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const cr = new ApiClient({ base: "https://api.crossref.org", rps: 2, defaultHeaders: { "User-Agent": `BabageMedAI (mailto:${process.env.CROSSREF_MAILTO || "ceo@babagemed.com"})` } });
export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: "Search RMD Open via Crossref.",
    input: z.object({ query: z.string().min(1), rows: z.number().int().min(1).max(100).optional() }),
    handler: async ({ query, rows = 20 }) => {
      const r = await cr.get<any>("works", { query, rows, "filter": "container-title:" + "RMD Open" });
      return { count: r?.message?.["total-results"], items: (r?.message?.items || []).map((w: any) => ({ doi: w.DOI, title: (w.title || [])[0], year: w.created?.["date-parts"]?.[0]?.[0], journal: (w["container-title"] || [])[0], url: w.URL, abstract: w.abstract })) };
    },
  });
  server.tool({
    name: "article",
    description: "Fetch a Crossref work by DOI.",
    input: z.object({ doi: z.string() }),
    handler: async ({ doi }) => cr.get<any>(`works/${encodeURIComponent(doi)}`),
  });
  
}
