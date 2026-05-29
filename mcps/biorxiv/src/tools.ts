// @generated-by write-real-tools.mjs (preserved by generate-mcps.mjs)
import { z, McpServer, ApiClient } from "@babbage/mcp-base";
const api = new ApiClient({ base: "https://api.biorxiv.org", rps: 2 });
const CHANNEL = "biorxiv";
export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: "Search biorxiv preprints by interval (YYYY-MM-DD/YYYY-MM-DD) or by DOI.",
    input: z.object({ interval: z.string().regex(/^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/).optional(), doi: z.string().optional(), cursor: z.number().int().min(0).optional() }),
    handler: async ({ interval, doi, cursor = 0 }) => {
      if (doi) return api.get<any>(`details/${CHANNEL}/${doi}/na/json`);
      if (!interval) {
        const today = new Date().toISOString().slice(0, 10);
        const old = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
        interval = `${old}/${today}`;
      }
      return api.get<any>(`details/${CHANNEL}/${interval}/${cursor}/json`);
    },
  });
  server.tool({
    name: "details",
    description: "Fetch full record for a DOI.",
    input: z.object({ doi: z.string() }),
    handler: async ({ doi }) => api.get<any>(`details/${CHANNEL}/${doi}/na/json`),
  });
}
