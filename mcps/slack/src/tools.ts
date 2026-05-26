// @generated-by write-real-tools.mjs (preserved by generate-mcps.mjs)
import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const TOKEN = process.env.SLACK_BOT_TOKEN || "";
const api = new ApiClient({ base: "https://slack.com/api", rps: 3, defaultHeaders: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/x-www-form-urlencoded" } });
function need() { if (!TOKEN) throw new Error("SLACK_BOT_TOKEN not configured"); }
export function registerTools(server: McpServer) {
  server.tool({ name: "post", description: "Post a message to a Slack channel.", input: z.object({ channel: z.string(), text: z.string() }), handler: async ({ channel, text }) => { need(); return api.post<any>("chat.postMessage", { channel, text }); } });
  server.tool({ name: "search", description: "Search Slack messages.", input: z.object({ query: z.string() }), handler: async ({ query }) => { need(); return api.get<any>("search.messages", { query }); } });
  server.tool({ name: "channels", description: "List Slack channels.", input: z.object({ limit: z.number().int().min(1).max(1000).optional() }), handler: async ({ limit = 100 }) => { need(); return api.get<any>("conversations.list", { limit }); } });
}
