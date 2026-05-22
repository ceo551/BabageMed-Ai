import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const T = process.env.HOSTINGER_API_TOKEN || "";
const api = new ApiClient({ base: "https://developers.hostinger.com/api", rps: 2, defaultHeaders: T ? { Authorization: `Bearer ${T}` } : {} });
function need(){ if(!T) throw new Error("HOSTINGER_API_TOKEN required"); }
export function registerTools(server: McpServer) {
  server.tool({ name: "domains", description: "List domains.", input: z.object({}), handler: async () => { need(); return api.get<any>("domain/v1/portfolio"); } });
  server.tool({ name: "vps", description: "List VPS instances.", input: z.object({}), handler: async () => { need(); return api.get<any>("vps/v1/virtual-machines"); } });
  server.tool({ name: "billing", description: "List billing.", input: z.object({}), handler: async () => { need(); return api.get<any>("billing/v1/orders"); } });
}
