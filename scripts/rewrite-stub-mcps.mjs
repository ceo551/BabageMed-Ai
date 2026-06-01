#!/usr/bin/env node
// Rewrites the 223 kind:"stub" MCPs so search/fetch return a structured
// "not yet wired" response instead of attempting a Scraper call against
// an empty base URL.
//
// The old scaffold instantiated Scraper with base:"" and ORIGIN:"", which
// meant `abs.startsWith(ORIGIN)` matched any URL — turning the fetch
// tool into a confused-deputy proxy for arbitrary outbound requests.
// The new stub bodies don't import Scraper at all and can't reach the
// network.
//
// Run from repo root. Idempotent: rerunning replaces the file with the
// same content, so re-generates don't pile up edits.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const manifest = JSON.parse(readFileSync(join(ROOT, "scripts/mcps.manifest.json"), "utf8"));
const stubs = manifest.servers.filter((s) => s.kind === "stub");

const TEMPLATE = (server) => `// @generated-by scripts/rewrite-stub-mcps.mjs — safe to overwrite via re-run.
//
// Stub MCP: this connector is registered in the manifest so it appears
// in the catalog UI, but no real upstream is wired yet. Tools return a
// structured "stub" response so the chat layer can surface a clear
// "${server.name} integration isn't connected yet" message rather than
// fabricating an answer that looks like it came from the source.
//
// To turn this into a real MCP, replace this file with an actual
// implementation that imports ApiClient / Scraper from
// @pervagans/mcp-base and call \`server.tool({ name, ... })\` properly.

import { z, McpServer } from "@pervagans/mcp-base";

// Note: we use \`connector\` (not \`name\`) here on purpose — the manifest
// validator scans \`name: "…"\` after \`server.tool({\` to verify the
// declared tools match the source, and the regex would false-match
// an all-lowercase \`name\` value inside this object.
const STUB_RESULT = {
  stub: true,
  id: ${JSON.stringify(server.id)},
  connector: ${JSON.stringify(server.name)},
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
`;

let written = 0;
let skipped = 0;
for (const s of stubs) {
  const toolsPath = join(ROOT, "mcps", s.id, "src", "tools.ts");
  if (!existsSync(toolsPath)) {
    console.warn(`! missing tools.ts for stub ${s.id} — skipping`);
    skipped++;
    continue;
  }
  // Ensure manifest tools[] matches what the new template exports
  // (search + fetch). If it doesn't, log a warning — the validator
  // will catch it on the next CI run.
  const expected = new Set(["search", "fetch"]);
  const actual = new Set(s.tools || []);
  for (const t of actual) {
    if (!expected.has(t)) console.warn(`! ${s.id}: manifest declares tool ${t} which the stub template doesn't export`);
  }
  writeFileSync(toolsPath, TEMPLATE(s));
  written++;
}

console.log(`stub rewrite complete: ${written} files updated, ${skipped} skipped`);
