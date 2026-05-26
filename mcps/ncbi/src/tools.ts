// @generated-by write-real-tools.mjs (preserved by generate-mcps.mjs)
import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils", rps: process.env.NCBI_API_KEY ? 9 : 2 });
const KEY = process.env.NCBI_API_KEY;
function base() { const q: Record<string,string> = { tool: "BabageMedAI", email: process.env.NCBI_EMAIL || "ceo@babagemed.com", retmode: "json" }; if (KEY) q.api_key = KEY; return q; }
export function registerTools(server: McpServer) {
  server.tool({ name: "einfo", description: "List NCBI databases or describe one.", input: z.object({ db: z.string().optional() }), handler: async ({ db }) => api.get<any>("einfo.fcgi", { ...base(), db }) });
  server.tool({ name: "esearch", description: "Search any NCBI DB.", input: z.object({ db: z.string(), term: z.string(), retmax: z.number().int().min(1).max(500).optional() }), handler: async ({ db, term, retmax = 20 }) => api.get<any>("esearch.fcgi", { ...base(), db, term, retmax }) });
  server.tool({ name: "efetch", description: "Fetch records by ID list.", input: z.object({ db: z.string(), id: z.string(), rettype: z.string().optional(), retmode: z.string().optional() }), handler: async ({ db, id, rettype, retmode }) => api.get<any>("efetch.fcgi", { ...base(), db, id, rettype, retmode }) });
  server.tool({ name: "elink", description: "Find linked records between DBs.", input: z.object({ dbfrom: z.string(), db: z.string(), id: z.string() }), handler: async ({ dbfrom, db, id }) => api.get<any>("elink.fcgi", { ...base(), dbfrom, db, id }) });
  server.tool({ name: "esummary", description: "Get document summaries.", input: z.object({ db: z.string(), id: z.string() }), handler: async ({ db, id }) => api.get<any>("esummary.fcgi", { ...base(), db, id }) });
}
