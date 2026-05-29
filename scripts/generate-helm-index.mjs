#!/usr/bin/env node
// Generates infra/helm/babbage/mcps-index.json (id → {kind, port, name})
// and infra/helm/babbage/mcps-all.txt (space-separated full id list).
// Re-run after changing scripts/mcps.manifest.json.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const manifest = JSON.parse(readFileSync(join(__dirname, "mcps.manifest.json"), "utf8"));

const chartDir = join(ROOT, "infra", "helm", "babbage");
mkdirSync(chartDir, { recursive: true });

const byId = {};
const all = [];
for (const s of manifest.servers) {
  byId[s.id] = { kind: s.kind, port: s.port, name: s.name, category: s.category };
  all.push(s.id);
}

writeFileSync(join(chartDir, "mcps-index.json"), JSON.stringify({ byId }, null, 2) + "\n");
writeFileSync(join(chartDir, "mcps-all.txt"), all.join(" ") + "\n");

console.log(`wrote ${all.length} entries to mcps-index.json + mcps-all.txt`);
