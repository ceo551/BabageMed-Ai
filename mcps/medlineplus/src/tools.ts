// @generated-by write-real-tools.mjs (preserved by generate-mcps.mjs)
import { z, McpServer, ApiClient } from "@babbage/mcp-base";
const api = new ApiClient({ base: "https://wsearch.nlm.nih.gov", rps: 3 });
export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: "Search MedlinePlus health topics.",
    input: z.object({ term: z.string().min(1), retmax: z.number().int().min(1).max(50).optional() }),
    handler: async ({ term, retmax = 10 }) => {
      const xml = await api.get<string>("/api/healthTopics", { db: "healthTopics", term, retmax, rettype: "brief" });
      return { format: "xml", xml };
    },
  });
  server.tool({
    name: "health",
    description: "Find a health topic page summary.",
    input: z.object({ term: z.string().min(1) }),
    handler: async ({ term }) => {
      const xml = await api.get<string>("/api/healthTopics", { db: "healthTopics", term, retmax: 5 });
      return { format: "xml", xml };
    },
  });
  server.tool({
    name: "drug",
    description: "Find drug info.",
    input: z.object({ name: z.string().min(1) }),
    handler: async ({ name }) => {
      const xml = await api.get<string>("/api/healthTopics", { db: "healthTopics", term: name + " drug", retmax: 5 });
      return { format: "xml", xml };
    },
  });
}
