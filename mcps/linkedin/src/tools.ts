// @hand-edited — do not regenerate via write-real-tools.mjs
import { z, McpServer, ApiClient } from "@pervagans/mcp-base";

const TOKEN = process.env.LINKEDIN_ACCESS_TOKEN || "";
// Authorization is attached PER REQUEST (authOverride) so a per-user token
// (ctx.credential, forwarded by the backend as X-MCP-Credential) takes
// precedence over the shared env token. The client keeps only the non-auth
// protocol header.
const api = new ApiClient({
  base: "https://api.linkedin.com/v2",
  rps: 1,
  defaultHeaders: { "X-Restli-Protocol-Version": "2.0.0" },
});

function authOverride(ctx: { credential?: string }): Record<string, string> {
  const token = (ctx.credential || TOKEN).trim();
  if (!token) throw new Error("LinkedIn not configured: connect with your access token");
  return { Authorization: `Bearer ${token}` };
}

// urn:li:person:XXXX shape. Without this any `author` value flows into
// the URL path and could rewrite the endpoint.
const personUrnSchema = z.string().regex(/^urn:li:(person|member|organization):[A-Za-z0-9_-]+$/);

export function registerTools(server: McpServer) {
  server.tool({
    name: "me",
    description: "Get the authenticated LinkedIn profile.",
    input: z.object({}),
    handler: async (_input, ctx) => api.get<any>("userinfo", undefined, { headers: authOverride(ctx) }),
  });
  server.tool({
    name: "posts",
    description: "List the authenticated member's posts.",
    input: z.object({
      author: personUrnSchema.describe("urn:li:person:..."),
      count: z.number().int().min(1).max(50).optional(),
      start: z.number().int().min(0).max(10_000).optional(),
    }),
    handler: async ({ author, count = 10, start = 0 }, ctx) =>
      api.get<any>("ugcPosts", { q: "authors", authors: author, count, start }, { headers: authOverride(ctx) }),
  });
  server.tool({
    name: "share",
    description: "Share a text post.",
    input: z.object({
      author: personUrnSchema,
      text: z.string().min(1).max(3000),
    }),
    handler: async ({ author, text }, ctx) =>
      api.post<any>("ugcPosts", {
        author,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text },
            shareMediaCategory: "NONE",
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }, { headers: authOverride(ctx) }),
  });
}
