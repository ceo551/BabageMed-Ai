// @generated-by write-real-tools.mjs (preserved by generate-mcps.mjs)
import { z, McpServer, ApiClient } from "@pervagans/mcp-base";
const TOKEN = process.env.SLACK_BOT_TOKEN || "";
// Authorization is attached PER REQUEST (authOverride) so a per-user token
// (ctx.credential, forwarded by the backend as X-MCP-Credential) takes
// precedence over the shared env bot token. The client keeps only the
// content-type default.
const api = new ApiClient({ base: "https://slack.com/api", rps: 3, defaultHeaders: { "Content-Type": "application/x-www-form-urlencoded" } });
function authOverride(ctx: { credential?: string }): Record<string, string> {
  const token = (ctx.credential || TOKEN).trim();
  if (!token) throw new Error("Slack not configured: connect with your bot token");
  return { Authorization: `Bearer ${token}` };
}
export function registerTools(server: McpServer) {
  server.tool({ name: "post", description: "Post a message to a Slack channel.", input: z.object({ channel: z.string(), text: z.string() }), handler: async ({ channel, text }, ctx) => api.post<any>("chat.postMessage", { channel, text }, { headers: authOverride(ctx) }) });
  server.tool({ name: "search", description: "Search Slack messages.", input: z.object({ query: z.string() }), handler: async ({ query }, ctx) => api.get<any>("search.messages", { query }, { headers: authOverride(ctx) }) });
  server.tool({ name: "channels", description: "List Slack channels.", input: z.object({ limit: z.number().int().min(1).max(1000).optional() }), handler: async ({ limit = 100 }, ctx) => api.get<any>("conversations.list", { limit }, { headers: authOverride(ctx) }) });
}
