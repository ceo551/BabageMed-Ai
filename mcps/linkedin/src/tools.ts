import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const TOKEN = process.env.LINKEDIN_ACCESS_TOKEN || "";
const api = new ApiClient({ base: "https://api.linkedin.com/v2", rps: 1, defaultHeaders: { Authorization: `Bearer ${TOKEN}`, "X-Restli-Protocol-Version": "2.0.0" } });
function need() { if (!TOKEN) throw new Error("LINKEDIN_ACCESS_TOKEN required"); }
export function registerTools(server: McpServer) {
  server.tool({ name: "me", description: "Get the authenticated LinkedIn profile.", input: z.object({}), handler: async () => { need(); return api.get<any>("userinfo"); } });
  server.tool({ name: "posts", description: "List the authenticated member's posts.", input: z.object({ author: z.string().describe("urn:li:person:..."), count: z.number().int().min(1).max(50).optional() }), handler: async ({ author, count = 10 }) => { need(); return api.get<any>("ugcPosts", { q: "authors", authors: author, count }); } });
  server.tool({ name: "share", description: "Share a text post.", input: z.object({ author: z.string(), text: z.string() }), handler: async ({ author, text }) => { need(); return api.post<any>("ugcPosts", { author, lifecycleState: "PUBLISHED", specificContent: { "com.linkedin.ugc.ShareContent": { shareCommentary: { text }, shareMediaCategory: "NONE" } }, visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" } }); } });
}
