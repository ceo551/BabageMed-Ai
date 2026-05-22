import { z, McpServer, ApiClient } from "@babagemed/mcp-base";
const TOKEN = process.env.GITHUB_TOKEN || "";
const api = new ApiClient({ base: "https://api.github.com", rps: 4, defaultHeaders: TOKEN ? { Authorization: `Bearer ${TOKEN}`, "X-GitHub-Api-Version": "2022-11-28" } : {} });
export function registerTools(server: McpServer) {
  server.tool({ name: "repos", description: "List repos for user.", input: z.object({ user: z.string().optional() }), handler: async ({ user }) => api.get<any>(user ? `users/${user}/repos` : "user/repos") });
  server.tool({ name: "issues", description: "List issues for a repo.", input: z.object({ owner: z.string(), repo: z.string(), state: z.enum(["open","closed","all"]).optional() }), handler: async ({ owner, repo, state = "open" }) => api.get<any>(`repos/${owner}/${repo}/issues`, { state }) });
  server.tool({ name: "prs", description: "List PRs for a repo.", input: z.object({ owner: z.string(), repo: z.string(), state: z.enum(["open","closed","all"]).optional() }), handler: async ({ owner, repo, state = "open" }) => api.get<any>(`repos/${owner}/${repo}/pulls`, { state }) });
  server.tool({ name: "search", description: "GitHub search.", input: z.object({ q: z.string(), type: z.enum(["code","issues","repositories","users","commits"]).optional() }), handler: async ({ q, type = "repositories" }) => api.get<any>(`search/${type}`, { q }) });
}
