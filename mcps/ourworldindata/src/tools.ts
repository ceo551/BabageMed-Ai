import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "https://ourworldindata.org", rps: 2 });
export function registerTools(server: McpServer) {
  server.tool({
    name: "dataset",
    description: "Download a CSV of an OWID chart by slug (returns rows).",
    input: z.object({ slug: z.string(), country: z.string().optional() }),
    handler: async ({ slug, country }) => {
      const csv = await api.get<string>(`grapher/${slug}.csv`, country ? { country } : undefined);
      const lines = String(csv).split("\n").slice(0, 1000);
      return { slug, rows: lines };
    },
  });
  server.tool({
    name: "chart",
    description: "Get OWID chart metadata JSON.",
    input: z.object({ slug: z.string() }),
    handler: async ({ slug }) => api.get<any>(`grapher/${slug}.metadata.json`),
  });
}
