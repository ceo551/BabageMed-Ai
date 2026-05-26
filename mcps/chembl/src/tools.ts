// @generated-by write-real-tools.mjs (preserved by generate-mcps.mjs)
import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "https://www.ebi.ac.uk/chembl/api/data", rps: 3 });
export function registerTools(server: McpServer) {
  server.tool({
    name: "molecule",
    description: "Search molecules by preferred name.",
    input: z.object({ name: z.string().min(1), limit: z.number().int().min(1).max(50).optional() }),
    handler: async ({ name, limit = 20 }) => api.get<any>("molecule.json", { pref_name__icontains: name, limit }),
  });
  server.tool({
    name: "target",
    description: "Search ChEMBL targets.",
    input: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(50).optional() }),
    handler: async ({ query, limit = 20 }) => api.get<any>("target.json", { pref_name__icontains: query, limit }),
  });
  server.tool({
    name: "activity",
    description: "Fetch activity records for a ChEMBL molecule.",
    input: z.object({ chembl_id: z.string(), limit: z.number().int().min(1).max(100).optional() }),
    handler: async ({ chembl_id, limit = 25 }) => api.get<any>("activity.json", { molecule_chembl_id: chembl_id, limit }),
  });
}
