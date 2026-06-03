#!/usr/bin/env node
// Validates scripts/mcps.manifest.json against the JSON Schema and checks
// the cross-file invariants that the schema can't express:
//
// - every manifest entry has a matching mcps/<id>/ directory
// - every mcps/<id>/ directory has a matching manifest entry (no orphans)
// - manifest tools[] matches the server.tool({name:...}) calls in tools.ts
// - ports are unique across the manifest
//
// Exit code 0 if everything is consistent, 1 otherwise.
//
// Run from CI to catch drift before deploy.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const manifest = JSON.parse(readFileSync(join(ROOT, "scripts/mcps.manifest.json"), "utf8"));
const servers = manifest.servers;

let problems = 0;
function fail(msg) {
  console.error("✗ " + msg);
  problems++;
}

// --- 1. JSON Schema (lightweight in-house — full ajv would add a dep)
const VALID_KINDS = new Set(["api", "scrape", "hybrid", "stub"]);
const VALID_FEATURES = new Set([
  "healthcare", "education", "writing", "translation",
  "data-analysis", "business", "financial", "consulting",
  "image", "video", "image-video", "advertisements",
]);
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const TOOL_RE = /^[a-z][a-z0-9_-]*$/;
for (const s of servers) {
  if (!s.id || !ID_RE.test(s.id)) fail(`bad id: ${JSON.stringify(s.id)}`);
  if (!s.name) fail(`${s.id}: missing name`);
  if (!VALID_KINDS.has(s.kind)) fail(`${s.id}: bad kind ${s.kind}`);
  if (typeof s.port !== "number" || s.port < 6101 || s.port > 6999) fail(`${s.id}: bad port ${s.port}`);
  if (!Array.isArray(s.tools) || s.tools.length === 0) fail(`${s.id}: tools[] must be non-empty array`);
  if (s.tools && s.tools.some((t) => !TOOL_RE.test(t))) fail(`${s.id}: tool name doesn't match ${TOOL_RE}`);
  if (!s.feature) fail(`${s.id}: missing feature (one of: ${[...VALID_FEATURES].join(", ")})`);
  else if (!VALID_FEATURES.has(s.feature)) fail(`${s.id}: bad feature ${JSON.stringify(s.feature)}`);
}

// --- 2. Unique ports + ids
const ports = new Map();
const ids = new Map();
for (const s of servers) {
  if (ports.has(s.port)) fail(`duplicate port ${s.port}: ${s.id} vs ${ports.get(s.port)}`);
  ports.set(s.port, s.id);
  if (ids.has(s.id)) fail(`duplicate id ${s.id}`);
  ids.set(s.id, true);
}

// --- 3. Manifest entry ↔ on-disk directory
const dirs = new Set(
  readdirSync(join(ROOT, "mcps"), { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name),
);
for (const s of servers) {
  if (!dirs.has(s.id)) fail(`manifest entry ${s.id} has no mcps/${s.id}/ directory`);
}
for (const d of dirs) {
  if (!ids.has(d)) fail(`mcps/${d}/ has no manifest entry`);
}

// --- 4. Manifest tools[] ↔ actual server.tool({name:...}) calls
function extractTools(src) {
  const names = [];
  // Find every `server.tool({` — then look at the next ~600 chars for the name field.
  const re = /server\.tool\(\s*\{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const chunk = src.slice(m.index, m.index + 700);
    const nm = chunk.match(/\bname:\s*["']([a-z][a-z0-9_-]*)["']/);
    if (nm) names.push(nm[1]);
  }
  // Handle the FDA-style loop variable.
  const loop = src.match(/for\s*\(\s*const\s*\[\s*name\s*,[^\]]*\]\s*of\s*\[(.*?)\]\s*as\s*const\)/s);
  if (loop) {
    const ns = [...loop[1].matchAll(/\[\s*["']([a-z][a-z0-9_-]*)["']/g)].map((mm) => mm[1]);
    names.push(...ns);
  }
  return [...new Set(names)];
}
for (const s of servers) {
  const tp = join(ROOT, "mcps", s.id, "src", "tools.ts");
  if (!existsSync(tp)) continue;
  const actual = extractTools(readFileSync(tp, "utf8"));
  if (actual.length === 0) continue; // some hand-edited files use indirect registration; skip
  const declared = new Set(s.tools);
  const found = new Set(actual);
  const missing = [...declared].filter((t) => !found.has(t));
  const extra = [...found].filter((t) => !declared.has(t));
  if (missing.length || extra.length) {
    fail(`${s.id}: tools[] drift — manifest=${JSON.stringify([...declared])} code=${JSON.stringify(actual)}`);
  }
}

if (problems === 0) {
  console.log(`✓ manifest validated (${servers.length} servers, ${dirs.size} dirs)`);
  process.exit(0);
}
console.error(`\n${problems} problem(s) — fix manifest or run scripts/generate-mcps.mjs`);
process.exit(1);
