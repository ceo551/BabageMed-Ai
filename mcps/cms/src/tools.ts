import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "https://data.cms.gov", rps: 3 });
export function registerTools(server: McpServer) {
  server.tool({
    name: "dataset",
    description: "Get a CMS dataset by id.",
    input: z.object({ id: z.string(), limit: z.number().int().min(1).max(10000).optional() }),
    handler: async ({ id, limit = 200 }) => api.get<any>(`data-api/v1/dataset/${id}/data`, { size: limit }),
  });
  server.tool({
    name: "coverage",
    description: "Search Medicare coverage policies (LCD/NCD) via CMS Coverage MCD JSON.",
    input: z.object({ query: z.string().min(1) }),
    handler: async ({ query }) => {
      const r: any = await fetch(`https://www.cms.gov/medicare-coverage-database/api/search?keyword=${encodeURIComponent(query)}`).then((r) => r.json()).catch(() => ({}));
      return r;
    },
  });
  server.tool({
    name: "lcd",
    description: "Look up a Local Coverage Determination by id.",
    input: z.object({ lcdId: z.string() }),
    handler: async ({ lcdId }): Promise<any> => fetch(`https://www.cms.gov/medicare-coverage-database/api/lcd/${encodeURIComponent(lcdId)}`).then((r) => r.json()),
  });
  server.tool({
    name: "ncd",
    description: "Look up a National Coverage Determination by id.",
    input: z.object({ ncdId: z.string() }),
    handler: async ({ ncdId }): Promise<any> => fetch(`https://www.cms.gov/medicare-coverage-database/api/ncd/${encodeURIComponent(ncdId)}`).then((r) => r.json()),
  });
}
