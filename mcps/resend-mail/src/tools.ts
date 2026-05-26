import { z, McpServer } from "@babagemed/mcp-base";

// Resend Mail — connector observed in the Perplexity Computer Connectors
// catalogue. Stub implementation: returns a "not yet configured" object so
// callers (the chat layer, the connectors picker) see a stable response
// shape until the OAuth / API-key wiring lands. The user-facing copy points
// at the official homepage so the model can suggest the right place to
// authenticate.
const HOMEPAGE = "https://resend.com";
const NOT_CONFIGURED = {
  status: "not-configured",
  message: "Resend Mail connector is registered but not yet authenticated. Add credentials in Settings → Connectors.",
  homepage: HOMEPAGE,
};

export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: "Search Resend Mail. Returns 'not-configured' until OAuth/API credentials are supplied.",
    input: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(50).optional() }),
    handler: async ({ query, limit = 10 }) => ({
      source: "Resend Mail",
      query,
      limit,
      count: 0,
      results: [],
      ...NOT_CONFIGURED,
    }),
  });

  server.tool({
    name: "fetch",
    description: "Fetch a record from Resend Mail by id or URL. Stub until configured.",
    input: z.object({ url: z.string().url() }).or(z.object({ id: z.string().min(1) })),
    handler: async (input) => ({
      source: "Resend Mail",
      input,
      ...NOT_CONFIGURED,
    }),
  });
}
