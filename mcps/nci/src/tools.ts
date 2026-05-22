import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "https://api-evsrest.nci.nih.gov/api/v1", rps: 3 });
export function registerTools(server: McpServer) {
  server.tool({
    name: "concept",
    description: "Get a concept by code in NCI Thesaurus (ncit).",
    input: z.object({ code: z.string() }),
    handler: async ({ code }) => api.get<any>(`concept/ncit/${code}`),
  });
  server.tool({
    name: "search",
    description: "Search NCI Thesaurus.",
    input: z.object({ term: z.string().min(1), terminology: z.string().optional(), pageSize: z.number().int().min(1).max(100).optional() }),
    handler: async ({ term, terminology = "ncit", pageSize = 20 }) =>
      api.get<any>("concept/search", { terminology, term, type: "match", pageSize }),
  });
  server.tool({
    name: "ncit",
    description: "Walk NCI Thesaurus parents and children for a code.",
    input: z.object({ code: z.string() }),
    handler: async ({ code }) => {
      const [parents, children] = await Promise.all([
        api.get<any>(`concept/ncit/${code}/parents`),
        api.get<any>(`concept/ncit/${code}/children`),
      ]);
      return { code, parents, children };
    },
  });
}
