#!/usr/bin/env node
// Deletes the 97 MCPs whose robots.txt either blocks our search path or
// can't be retrieved (403/timeout/auth required). Patches all known
// registries so a follow-up `helm upgrade` and image rebuild stays consistent.
//
// Touches:
//   - mcps/<id>/                                  (rmdir -r)
//   - infra/helm/pervagans/mcps-all.txt           (space-separated)
//   - infra/helm/pervagans/mcps-index.json        ({ byId: { … } })
//   - infra/helm/pervagans/templates/_helpers.tpl ('default' preset literal)
//   - scripts/mcps.manifest.json                  (servers: [{id, …}])
//   - docker-compose.mcps.yml                     (per-MCP service block)
//   - frontend/app/components/ConnectorIcon.tsx   (logo map, cosmetic)
import fs from "node:fs";
import path from "node:path";
const ROOT = process.cwd();

const report = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/robots-report.json"), "utf8"));
const toRemove = report.mcps.filter((m) => m.verdict === "blocked" || m.verdict === "fetch_error").map((m) => m.id);
console.log(`Will remove ${toRemove.length} MCPs: ${toRemove.join(", ")}`);
const removeSet = new Set(toRemove);

// --- 1. mcps/<id> dirs ------------------------------------------------------
let dirsGone = 0;
for (const id of toRemove) {
  const dir = path.join(ROOT, "mcps", id);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    dirsGone++;
  }
}
console.log(`  removed ${dirsGone} mcps/ directories`);

// --- 2. mcps-all.txt (single space-separated line) --------------------------
const allPath = path.join(ROOT, "infra/helm/pervagans/mcps-all.txt");
const allTokens = fs.readFileSync(allPath, "utf8").split(/\s+/).filter(Boolean);
const allKept = allTokens.filter((t) => !removeSet.has(t));
fs.writeFileSync(allPath, allKept.join(" ") + "\n");
console.log(`  mcps-all.txt: ${allTokens.length} -> ${allKept.length}`);

// --- 3. mcps-index.json ------------------------------------------------------
const indexPath = path.join(ROOT, "infra/helm/pervagans/mcps-index.json");
const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
let idxRemoved = 0;
for (const id of Object.keys(index.byId)) {
  if (removeSet.has(id)) { delete index.byId[id]; idxRemoved++; }
}
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");
console.log(`  mcps-index.json: removed ${idxRemoved}`);

// --- 4. _helpers.tpl 'default' preset line ----------------------------------
const tplPath = path.join(ROOT, "infra/helm/pervagans/templates/_helpers.tpl");
let tpl = fs.readFileSync(tplPath, "utf8");
// The 'default' preset is a single line listing IDs separated by spaces, between
// `preset "default"` and the next `{{- else -}}`. We rewrite that line only.
tpl = tpl.replace(
  /(\{\{-\s*else if eq \.Values\.mcps\.preset\s+"default"\s*-\}\}\s*\n)([^\n]+)/,
  (_match, header, line) => {
    const filtered = line.split(/\s+/).filter(Boolean).filter((t) => !removeSet.has(t));
    return header + filtered.join(" ");
  }
);
fs.writeFileSync(tplPath, tpl);
console.log(`  _helpers.tpl: default preset rewritten`);

// --- 5. mcps.manifest.json ---------------------------------------------------
const manPath = path.join(ROOT, "scripts/mcps.manifest.json");
const man = JSON.parse(fs.readFileSync(manPath, "utf8"));
const before = man.servers.length;
man.servers = man.servers.filter((s) => !removeSet.has(s.id));
fs.writeFileSync(manPath, JSON.stringify(man, null, 2) + "\n");
console.log(`  mcps.manifest.json: ${before} -> ${man.servers.length}`);

// --- 6. docker-compose.mcps.yml ---------------------------------------------
// Each MCP is a top-level service `mcp-<id>:`. Drop the block from start-of-line
// `  mcp-<id>:` to (but not including) the next `  mcp-` line (or EOF).
const composePath = path.join(ROOT, "docker-compose.mcps.yml");
let compose = fs.readFileSync(composePath, "utf8");
const lines = compose.split("\n");
const kept = [];
let skipping = false;
for (const line of lines) {
  const m = line.match(/^  mcp-([a-z0-9-]+):\s*$/i);
  if (m) {
    skipping = removeSet.has(m[1]);
    if (!skipping) kept.push(line);
    continue;
  }
  if (!skipping) kept.push(line);
}
fs.writeFileSync(composePath, kept.join("\n"));
console.log(`  docker-compose.mcps.yml: ${lines.length} -> ${kept.length} lines`);

// --- 7. ConnectorIcon.tsx logo map (cosmetic; map entries are short) --------
const iconPath = path.join(ROOT, "frontend/app/components/ConnectorIcon.tsx");
if (fs.existsSync(iconPath)) {
  let icon = fs.readFileSync(iconPath, "utf8");
  let iconBefore = icon.length;
  for (const id of toRemove) {
    // Match  `  <id>: "...logo...",`  including the trailing comma + newline.
    const rx = new RegExp(`\\n\\s*${id.replace(/[-/.]/g, "\\$&")}:\\s*"[^"]*",`, "g");
    icon = icon.replace(rx, "");
  }
  fs.writeFileSync(iconPath, icon);
  console.log(`  ConnectorIcon.tsx: ${iconBefore} -> ${icon.length} bytes`);
}

// --- Final report ------------------------------------------------------------
const summary = {
  generatedAt: new Date().toISOString(),
  removedCount: toRemove.length,
  removedIds: toRemove,
  remaining: allKept.length,
  reasonByCategory: {
    robotsDisallow: report.mcps.filter((m) => m.verdict === "blocked").length,
    fetchError:     report.mcps.filter((m) => m.verdict === "fetch_error").length,
  },
};
fs.writeFileSync(path.join(ROOT, "scripts/robots-purge-summary.json"), JSON.stringify(summary, null, 2));
console.log(`\nDone. ${toRemove.length} MCPs removed, ${allKept.length} remain.`);
console.log(`Summary -> scripts/robots-purge-summary.json`);
