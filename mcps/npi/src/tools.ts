import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "https://npiregistry.cms.hhs.gov/api", rps: 3 });
export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: "Search the NPPES NPI registry.",
    input: z.object({
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      organization_name: z.string().optional(),
      city: z.string().optional(),
      state: z.string().length(2).optional(),
      postal_code: z.string().optional(),
      taxonomy_description: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    handler: async (i) => api.get<any>("", { version: "2.1", ...i, limit: i.limit ?? 20 }),
  });
  server.tool({
    name: "lookup",
    description: "Look up a provider by NPI number.",
    input: z.object({ number: z.string() }),
    handler: async ({ number }) => api.get<any>("", { version: "2.1", number }),
  });
}
