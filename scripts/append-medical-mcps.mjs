#!/usr/bin/env node
// Idempotently merges scripts/medical-sites.json into scripts/mcps.manifest.json.
// Run AFTER changing the medical-sites list, then re-run generate-mcps.mjs.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MAN_PATH = join(__dirname, "mcps.manifest.json");
const SITES_PATH = join(__dirname, "medical-sites.json");

const manifest = JSON.parse(readFileSync(MAN_PATH, "utf8"));
const sites = JSON.parse(readFileSync(SITES_PATH, "utf8"));

const existing = new Set(manifest.servers.map((s) => s.id));
let port = sites.startPort;
let added = 0;
let skipped = 0;

// Re-use already-assigned ports for entries that exist (idempotent re-runs).
const existingById = new Map(manifest.servers.map((s) => [s.id, s]));

const newRows = [];
for (const [id, name, base, category] of sites.sites) {
  if (existing.has(id)) {
    skipped++;
    continue;
  }
  newRows.push({
    id,
    name,
    kind: sites.kind || "scrape",
    category,
    port: port++,
    base,
    tools: ["search", "fetch"],
    // This script appends medical / life-sciences sources — assign the
    // healthcare feature so validate-manifest.mjs accepts new rows
    // without a manual second pass.
    feature: "healthcare",
  });
  added++;
}

manifest.servers.push(...newRows);
writeFileSync(MAN_PATH, JSON.stringify(manifest, null, 2) + "\n");

console.log(`appended ${added} entries (skipped ${skipped} already-present), total: ${manifest.servers.length}`);
