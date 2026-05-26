import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const KEY = process.env.NHS_API_KEY || "";
const api = new ApiClient({ base: "https://api.nhs.uk", rps: 2, defaultHeaders: KEY ? { "subscription-key": KEY, apikey: KEY } : {} });
export function registerTools(server: McpServer) {
  server.tool({ name: "conditions", description: "Look up an NHS condition page.", input: z.object({ slug: z.string() }), handler: async ({ slug }) => api.get<any>(`conditions/${slug}`) });
  server.tool({ name: "medicines", description: "Look up an NHS medicine.", input: z.object({ slug: z.string() }), handler: async ({ slug }) => api.get<any>(`medicines/${slug}`) });
  server.tool({ name: "live-well", description: "Look up Live Well topic.", input: z.object({ slug: z.string() }), handler: async ({ slug }) => api.get<any>(`live-well/${slug}`) });
}
