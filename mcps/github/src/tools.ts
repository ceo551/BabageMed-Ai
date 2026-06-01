// @hand-edited — do not regenerate via write-real-tools.mjs
import { z, McpServer, ApiClient } from "@pervagans/mcp-base";

const TOKEN = process.env.GITHUB_TOKEN || "";
const api = new ApiClient({
  base: "https://api.github.com",
  rps: 4,
  defaultHeaders: TOKEN ? { Authorization: `Bearer ${TOKEN}`, "X-GitHub-Api-Version": "2022-11-28" } : {},
});

// Tightly bound: owner/repo names are limited to the chars GitHub itself
// allows for those identifiers. Without this a value like "foo/bar"
// breaks out of the path segment into a different endpoint, and "..%2f.."
// could traverse the API namespace.
const ownerRepoSchema = z.string().regex(/^[A-Za-z0-9._-]{1,100}$/, "must match GitHub owner/repo name rules");

function needToken(toolName: string) {
  if (!TOKEN) {
    throw new Error(`GitHub MCP "${toolName}" requires GITHUB_TOKEN. Anonymous requests are rate-limited to 60/hour per egress IP and would shadow-block the pod.`);
  }
}

export function registerTools(server: McpServer) {
  server.tool({
    name: "repos",
    description: "List repos for a user.",
    // `user` is REQUIRED so we never fall through to `user/repos` (which
    // needs auth) when the env token is unset. The previous default
    // exhausted the 60 req/hr anonymous quota for the egress IP.
    input: z.object({ user: ownerRepoSchema }),
    handler: async ({ user }) => api.get<any>(`users/${encodeURIComponent(user)}/repos`),
  });
  server.tool({
    name: "issues",
    description: "List issues for a repo.",
    input: z.object({
      owner: ownerRepoSchema,
      repo: ownerRepoSchema,
      state: z.enum(["open", "closed", "all"]).optional(),
    }),
    handler: async ({ owner, repo, state = "open" }) =>
      api.get<any>(`repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`, { state }),
  });
  server.tool({
    name: "prs",
    description: "List PRs for a repo.",
    input: z.object({
      owner: ownerRepoSchema,
      repo: ownerRepoSchema,
      state: z.enum(["open", "closed", "all"]).optional(),
    }),
    handler: async ({ owner, repo, state = "open" }) =>
      api.get<any>(`repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`, { state }),
  });
  server.tool({
    name: "search",
    description: "GitHub search.",
    input: z.object({
      q: z.string().min(1).max(256),
      type: z.enum(["code", "issues", "repositories", "users", "commits"]).optional(),
    }),
    handler: async ({ q, type = "repositories" }) => {
      // code search is privileged (10 rpm) and requires auth.
      if (type === "code") needToken("search type=code");
      return api.get<any>(`search/${type}`, { q });
    },
  });
}
