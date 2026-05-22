import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const api = new ApiClient({ base: "https://api.fda.gov", rps: 4 });
const KEY = process.env.OPENFDA_API_KEY;
function withKey(q: Record<string, any>) { return KEY ? { ...q, api_key: KEY } : q; }
export function registerTools(server: McpServer) {
  for (const [name, endpoint] of [["drug","drug/label.json"],["event","drug/event.json"],["device","device/event.json"],["food","food/enforcement.json"]] as const) {
    server.tool({
      name,
      description: `openFDA ${name} search.`,
      input: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(100).optional() }),
      handler: async ({ query, limit = 10 }) => api.get<any>(endpoint, withKey({ search: query, limit })),
    });
  }
  server.tool({
    name: "label",
    description: "Look up a drug label by brand or generic name.",
    input: z.object({ name: z.string().min(1) }),
    handler: async ({ name }) => {
      return api.get<any>("drug/label.json", withKey({
        search: `openfda.brand_name:"${name}" OR openfda.generic_name:"${name}"`,
        limit: 5,
      }));
    },
  });
}
