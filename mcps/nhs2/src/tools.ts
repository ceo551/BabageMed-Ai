import { z, McpServer, ApiClient } from "@babagemed/mcp-base";

const KEY = process.env.NHS_API_KEY || "";
const api = new ApiClient({
  base: "https://api.nhs.uk",
  rps: 2,
  // Strip the duplicate `apikey` header that was leaking the credential.
  defaultHeaders: KEY ? { "subscription-key": KEY } : {},
});

const slugSchema = z.string().regex(/^[a-z0-9-]{1,128}$/);

export function registerTools(server: McpServer) {
  server.tool({ name: "conditions", description: "Look up an NHS condition page.", input: z.object({ slug: slugSchema }), handler: async ({ slug }) => api.get<any>(`conditions/${encodeURIComponent(slug)}`) });
  server.tool({ name: "medicines", description: "Look up an NHS medicine.", input: z.object({ slug: slugSchema }), handler: async ({ slug }) => api.get<any>(`medicines/${encodeURIComponent(slug)}`) });
  server.tool({ name: "live-well", description: "Look up Live Well topic.", input: z.object({ slug: slugSchema }), handler: async ({ slug }) => api.get<any>(`live-well/${encodeURIComponent(slug)}`) });
}
