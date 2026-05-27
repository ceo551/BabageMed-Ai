// @generated-by scripts/rewrite-stub-mcps.mjs — safe to overwrite via re-run.
//
// Stub MCP: this connector is registered in the manifest so it appears
// in the catalog UI, but no real upstream is wired yet. Tools return a
// structured "stub" response so the chat layer can surface a clear
// "DocuGenerate integration isn't connected yet" message rather than
// fabricating an answer that looks like it came from the source.
//
// To turn this into a real MCP, replace this file with an actual
// implementation that imports ApiClient / Scraper from
// @babagemed/mcp-base and call `server.tool({ name, ... })` properly.

import { z, McpServer } from "@babagemed/mcp-base";

// Note: we use `connector` (not `name`) here on purpose — the manifest
// validator scans `name: "…"` after `server.tool({` to verify the
// declared tools match the source, and the regex would false-match
// an all-lowercase `name` value inside this object.
const STUB_RESULT = {
  stub: true,
  id: "docugenerate",
  connector: "DocuGenerate",
  message: "This connector isn't wired yet — pick a different source or contact support to prioritise it.",
};

export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: "Stub — returns a not-implemented marker the chat layer can render.",
    input: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(50).optional() }),
    handler: async ({ query }) => ({ ...STUB_RESULT, query, results: [] }),
  });

  server.tool({
    name: "fetch",
    description: "Stub — returns a not-implemented marker the chat layer can render.",
    input: z.object({ url: z.string().min(1) }),
    handler: async ({ url }) => ({ ...STUB_RESULT, url }),
  });
}
