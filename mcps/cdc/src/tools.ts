// @generated-by write-real-tools.mjs (preserved by generate-mcps.mjs)
import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const TOKEN = process.env.SOCRATA_APP_TOKEN;
const api = new ApiClient({
  base: "https://data.cdc.gov/resource",
  rps: 3,
  defaultHeaders: TOKEN ? { "X-App-Token": TOKEN } : {},
});
export function registerTools(server: McpServer) {
  server.tool({
    name: "dataset",
    description: "Query a specific CDC Socrata dataset by 4x4 code.",
    input: z.object({
      datasetId: z.string().regex(/^[a-z0-9]{4}-[a-z0-9]{4}$/i),
      where: z.string().optional(),
      select: z.string().optional(),
      order: z.string().optional(),
      limit: z.number().int().min(1).max(50000).optional(),
    }),
    handler: async ({ datasetId, where, select, order, limit = 100 }) =>
      api.get<any>(`${datasetId}.json`, { $where: where, $select: select, $order: order, $limit: limit }),
  });
  server.tool({
    name: "search",
    description: "Search CDC data.cdc.gov for datasets matching a query.",
    input: z.object({ query: z.string().min(1) }),
    handler: async ({ query }) => {
      const r: any = await fetch(`https://api.us.socrata.com/api/catalog/v1?domains=data.cdc.gov&q=${encodeURIComponent(query)}&limit=20`).then((r) => r.json());
      return { count: r.resultSetSize, results: r.results?.map((x: any) => ({ name: x.resource?.name, id: x.resource?.id, desc: x.resource?.description, url: x.permalink })) };
    },
  });
  server.tool({
    name: "row",
    description: "Fetch a single row from a dataset by row identifier.",
    input: z.object({ datasetId: z.string(), id: z.string() }),
    handler: async ({ datasetId, id }) => api.get<any>(`${datasetId}.json`, { $where: `${id}` }),
  });
}
