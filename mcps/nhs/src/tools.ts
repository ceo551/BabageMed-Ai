// @hand-edited — do not regenerate via write-real-tools.mjs
import { z, McpServer, ApiClient } from "@babagemed/mcp-base";

const KEY = process.env.NHS_API_KEY || "";
// `apikey` was being sent alongside `subscription-key`. The official
// "NHS website Content API" only honours subscription-key; sending both
// uselessly leaks the credential to anyone logging the second header on
// intermediary edge proxies.
const api = new ApiClient({
  base: "https://api.nhs.uk",
  rps: 2,
  defaultHeaders: KEY ? { "subscription-key": KEY } : {},
});

// All three tools interpolate `slug` into the URL path. We restrict the
// shape so a caller can't pass "../search?key=x" or any non-slug value
// that would let them traverse into a different namespace of the API.
const slugSchema = z.string().regex(/^[a-z0-9-]{1,128}$/, "slug must be lowercase letters / digits / hyphens");

export function registerTools(server: McpServer) {
  server.tool({
    name: "conditions",
    description: "Look up an NHS condition page.",
    input: z.object({ slug: slugSchema.describe("e.g. 'high-blood-pressure-hypertension'") }),
    handler: async ({ slug }) => api.get<any>(`conditions/${encodeURIComponent(slug)}`),
  });
  server.tool({
    name: "medicines",
    description: "Look up an NHS medicine page.",
    input: z.object({ slug: slugSchema }),
    handler: async ({ slug }) => api.get<any>(`medicines/${encodeURIComponent(slug)}`),
  });
  server.tool({
    name: "live-well",
    description: "Look up NHS Live Well topic.",
    input: z.object({ slug: slugSchema }),
    handler: async ({ slug }) => api.get<any>(`live-well/${encodeURIComponent(slug)}`),
  });
}
