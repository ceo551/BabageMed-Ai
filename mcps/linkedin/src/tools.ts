// @hand-edited — do not regenerate via write-real-tools.mjs
import { z, McpServer, ApiClient } from "@babbage/mcp-base";

const TOKEN = process.env.LINKEDIN_ACCESS_TOKEN || "";
// Only attach Authorization when we actually have a token — previously
// `Bearer ` (empty) was sent on every request, which any logging proxy
// would record and which produced a confusing 401 if `need()` was ever
// forgotten on a future tool.
const api = new ApiClient({
  base: "https://api.linkedin.com/v2",
  rps: 1,
  defaultHeaders: TOKEN
    ? { Authorization: `Bearer ${TOKEN}`, "X-Restli-Protocol-Version": "2.0.0" }
    : { "X-Restli-Protocol-Version": "2.0.0" },
});

function need() { if (!TOKEN) throw new Error("LINKEDIN_ACCESS_TOKEN required"); }

// urn:li:person:XXXX shape. Without this any `author` value flows into
// the URL path and could rewrite the endpoint.
const personUrnSchema = z.string().regex(/^urn:li:(person|member|organization):[A-Za-z0-9_-]+$/);

export function registerTools(server: McpServer) {
  server.tool({
    name: "me",
    description: "Get the authenticated LinkedIn profile.",
    input: z.object({}),
    handler: async () => { need(); return api.get<any>("userinfo"); },
  });
  server.tool({
    name: "posts",
    description: "List the authenticated member's posts.",
    input: z.object({
      author: personUrnSchema.describe("urn:li:person:..."),
      count: z.number().int().min(1).max(50).optional(),
      start: z.number().int().min(0).max(10_000).optional(),
    }),
    handler: async ({ author, count = 10, start = 0 }) => {
      need();
      return api.get<any>("ugcPosts", { q: "authors", authors: author, count, start });
    },
  });
  server.tool({
    name: "share",
    description: "Share a text post.",
    input: z.object({
      author: personUrnSchema,
      text: z.string().min(1).max(3000),
    }),
    handler: async ({ author, text }) => {
      need();
      return api.post<any>("ugcPosts", {
        author,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text },
            shareMediaCategory: "NONE",
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      });
    },
  });
}
