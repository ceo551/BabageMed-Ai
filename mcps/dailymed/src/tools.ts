import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "https://dailymed.nlm.nih.gov/dailymed/services/v2", rps: 3 });
export function registerTools(server: McpServer) {
  server.tool({
    name: "spls",
    description: "Search Structured Product Labels (SPLs).",
    input: z.object({ drug_name: z.string().optional(), setid: z.string().optional(), page: z.number().int().min(1).optional() }),
    handler: async ({ drug_name, setid, page = 1 }) => api.get<any>("spls.json", { drug_name, setid, page, pagesize: 25 }),
  });
  server.tool({
    name: "drugnames",
    description: "List drug names matching a query.",
    input: z.object({ name: z.string().min(1) }),
    handler: async ({ name }) => api.get<any>("drugnames.json", { drug_name: name, pagesize: 50 }),
  });
  server.tool({
    name: "ndc",
    description: "Look up an NDC.",
    input: z.object({ ndc: z.string() }),
    handler: async ({ ndc }) => api.get<any>("ndcs.json", { ndc }),
  });
}
