import { z, McpServer, ApiClient } from "@babagemed/mcp-base";

const api = new ApiClient({
  base: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
  rps: process.env.NCBI_API_KEY ? 9 : 2,
  userAgent: process.env.SCRAPER_USER_AGENT,
});

const KEY = process.env.NCBI_API_KEY;
const TOOL = process.env.NCBI_TOOL || "BabageMedAI";
const EMAIL = process.env.NCBI_EMAIL || "ceo@babagemed.com";

function baseQuery() {
  const q: Record<string, string> = { tool: TOOL, email: EMAIL, db: "pubmed", retmode: "json" };
  if (KEY) q.api_key = KEY;
  return q;
}

export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: "Search PubMed for articles. Returns PMIDs and basic metadata.",
    input: z.object({
      query: z.string().min(1).describe("PubMed query (e.g. 'CKD AND piperacillin')"),
      retmax: z.number().int().min(1).max(200).optional(),
      sort: z.enum(["relevance", "pub_date", "first_author"]).optional(),
      mindate: z.string().optional().describe("YYYY/MM/DD"),
      maxdate: z.string().optional().describe("YYYY/MM/DD"),
    }),
    handler: async ({ query, retmax = 20, sort, mindate, maxdate }) => {
      const search = await api.get<any>("esearch.fcgi", {
        ...baseQuery(),
        term: query,
        retmax,
        sort,
        mindate,
        maxdate,
        datetype: mindate || maxdate ? "pdat" : undefined,
      });
      const ids: string[] = search?.esearchresult?.idlist || [];
      if (ids.length === 0) return { count: 0, results: [] };
      const summary = await api.get<any>("esummary.fcgi", { ...baseQuery(), id: ids.join(",") });
      const results = ids.map((id) => {
        const r = summary?.result?.[id] || {};
        return {
          pmid: id,
          title: r.title,
          authors: (r.authors || []).map((a: any) => a.name).slice(0, 8),
          journal: r.fulljournalname || r.source,
          pubdate: r.pubdate,
          doi: (r.articleids || []).find((a: any) => a.idtype === "doi")?.value,
          url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        };
      });
      return { count: Number(search?.esearchresult?.count || results.length), results };
    },
  });

  server.tool({
    name: "fetch",
    description: "Fetch the full abstract for one or more PMIDs.",
    input: z.object({ pmids: z.array(z.string()).min(1).max(50) }),
    handler: async ({ pmids }) => {
      const xml = await api.get<string>("efetch.fcgi", { ...baseQuery(), retmode: "xml", id: pmids.join(",") });
      const articles: { pmid: string; title?: string; abstract?: string }[] = [];
      const blocks = String(xml).split("<PubmedArticle>").slice(1);
      for (const b of blocks) {
        const pmid = b.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1] || "";
        const title = b.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)?.[1]?.replace(/<[^>]+>/g, "").trim();
        const abs = [...b.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)]
          .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
          .join("\n\n");
        articles.push({ pmid, title, abstract: abs });
      }
      return { count: articles.length, articles };
    },
  });

  server.tool({
    name: "summary",
    description: "Return PubMed esummary records for PMIDs.",
    input: z.object({ pmids: z.array(z.string()).min(1).max(50) }),
    handler: async ({ pmids }) => {
      const r = await api.get<any>("esummary.fcgi", { ...baseQuery(), id: pmids.join(",") });
      return r?.result ?? {};
    },
  });

  server.tool({
    name: "related",
    description: "Find articles related to a PMID via elink.",
    input: z.object({ pmid: z.string() }),
    handler: async ({ pmid }) => {
      const r = await api.get<any>("elink.fcgi", { ...baseQuery(), dbfrom: "pubmed", id: pmid, cmd: "neighbor" });
      const linksets = r?.linksets?.[0]?.linksetdbs || [];
      const related = linksets.find((l: any) => l.linkname === "pubmed_pubmed")?.links || [];
      return { pmid, related: related.slice(0, 20) };
    },
  });
}
