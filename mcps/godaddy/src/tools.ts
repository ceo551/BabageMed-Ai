import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const K = process.env.GODADDY_API_KEY || "";
const S = process.env.GODADDY_API_SECRET || "";
const api = new ApiClient({ base: "https://api.godaddy.com/v1", rps: 2, defaultHeaders: K && S ? { Authorization: `sso-key ${K}:${S}` } : {} });
function need(){ if(!K || !S) throw new Error("GODADDY_API_KEY+SECRET required"); }
export function registerTools(server: McpServer) {
  server.tool({ name: "domains", description: "List domains.", input: z.object({}), handler: async () => { need(); return api.get<any>("domains"); } });
  server.tool({ name: "dns", description: "Get DNS records for a domain.", input: z.object({ domain: z.string() }), handler: async ({ domain }) => { need(); return api.get<any>(`domains/${domain}/records`); } });
  server.tool({ name: "orders", description: "List shopper orders.", input: z.object({}), handler: async () => { need(); return api.get<any>("orders"); } });
}
