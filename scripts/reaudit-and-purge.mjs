#!/usr/bin/env node
// Re-audit ALL scraping MCPs currently in the repo (post first-pass purge):
//   - Walks every mcps/<id>/src/tools.ts
//   - Detects scraper-driven MCPs (has `new Scraper(` or `scraper.fetchHtml`)
//   - Extracts the search URL via three patterns:
//       1. SEARCH_URL = "..."
//       2. inline "https://.../{q}..."
//       3. inline template `https://...${...}...`
//   - Also probes a representative article path so we catch sites that allow
//     /search but disallow content paths (and vice versa).
//   - Fetches robots.txt with retries
//   - Deletes any MCP whose search OR article path is blocked / errored
//   - Patches the same registries as delete-blocked-mcps.mjs

import fs from "node:fs"; import path from "node:path"; import https from "node:https"; import http from "node:http";
const ROOT = process.cwd();
const MCPS = path.join(ROOT, "mcps");

// ── 1. Enumerate every scraping MCP currently present ──────────────────────
const mcpIds = fs.readdirSync(MCPS, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_") && !d.name.startsWith("."))
  .map((d) => d.name);

const mcps = [];
for (const id of mcpIds) {
  const tp = path.join(MCPS, id, "src", "tools.ts");
  if (!fs.existsSync(tp)) continue;
  const src = fs.readFileSync(tp, "utf8");
  const isScraping = /new Scraper\(/.test(src) || /scraper\.fetchHtml/.test(src);
  if (!isScraping) continue;
  let searchUrl = null;
  const m0 = src.match(/SEARCH_URL\s*=\s*"([^"]+)"/);
  if (m0) searchUrl = m0[1];
  if (!searchUrl) { const m1 = src.match(/"(https?:\/\/[^"]*\{q\}[^"]*)"/); if (m1) searchUrl = m1[1]; }
  if (!searchUrl) {
    const m2 = src.match(/`(https?:\/\/[^`]*\$\{[^`]*\}[^`]*)`/);
    if (m2) searchUrl = m2[1].replace(/\$\{[^}]*\}/g, "test");
  }
  if (!searchUrl) {
    const b = src.match(/base:\s*"([^"]+)"/);
    if (b) searchUrl = b[1].replace(/\/$/, "") + "/search?q=test";
  }
  if (!searchUrl) continue;
  let origin = ""; try { origin = new URL(searchUrl.replace(/\{q\}/g, "test")).origin; } catch {}
  if (!origin || !/^https?:/i.test(origin)) continue;
  let searchPath = "/"; try { const u = new URL(searchUrl.replace(/\{q\}/g, "test")); searchPath = u.pathname + (u.search || ""); } catch {}
  mcps.push({ id, origin, searchUrl, searchPath });
}
console.log(`re-auditing ${mcps.length} scraping MCPs`);

// ── 2. Fetch robots.txt per unique origin ──────────────────────────────────
const UA = "Mozilla/5.0 (compatible; BabageMedBot/1.0; +https://babagemed.com)";
function fetchOnce(url, timeout) {
  return new Promise((resolve) => {
    let u; try { u = new URL(url); } catch { return resolve({ status: 0, error: "bad-url" }); }
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request(u, { method: "GET", headers: { "User-Agent": UA, "Accept": "text/plain,*/*" }, timeout }, (res) => {
      if ([301,302,307,308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        try { return resolve(fetchOnce(new URL(res.headers.location, u).toString(), timeout)); } catch {}
      }
      let buf = ""; res.setEncoding("utf8");
      res.on("data", (c) => { if (buf.length < 200_000) buf += c; });
      res.on("end", () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, error: "timeout" }); });
    req.on("error", (e) => resolve({ status: 0, error: e.code || e.message }));
    req.end();
  });
}
function hard(p, ms, label) { return Promise.race([p, new Promise((r) => setTimeout(() => r({ status: 0, error: `hard-timeout ${label}` }), ms))]); }
async function tryOrigin(origin) {
  for (let i = 0; i < 2; i++) {
    const r = await hard(fetchOnce(new URL("/robots.txt", origin).toString(), 25000), 30000, origin);
    if (r.status > 0) return r;
  }
  return { status: 0, error: "all-attempts-failed" };
}
async function pool(items, n, w) {
  let i = 0; const out = new Array(items.length);
  await Promise.all(Array.from({length:n}, async () => { while (true) { const idx = i++; if (idx >= items.length) return; out[idx] = await w(items[idx], idx); } }));
  return out;
}

const origins = [...new Set(mcps.map((m) => m.origin))];
console.log(`probing ${origins.length} unique origins`);
let done = 0;
const results = await pool(origins, 24, async (origin) => {
  const r = await tryOrigin(origin);
  done++; if (done % 20 === 0) process.stdout.write(`[${done}/${origins.length}]`);
  return [origin, r];
});
process.stdout.write("\n");
const byOrigin = Object.fromEntries(results);

// ── 3. Parse robots.txt + evaluate verdicts ────────────────────────────────
function parseRobots(body) {
  const groups = []; let current = null;
  for (let raw of body.split(/\r?\n/)) {
    raw = raw.replace(/#.*$/, "").trim(); if (!raw) continue;
    const m = raw.match(/^([A-Za-z-]+)\s*:\s*(.*)$/); if (!m) continue;
    const field = m[1].toLowerCase(), value = m[2].trim();
    if (field === "user-agent") {
      if (!current || current.rules.length > 0) { current = { agents: [value.toLowerCase()], rules: [] }; groups.push(current); }
      else current.agents.push(value.toLowerCase());
    } else if (current && (field === "disallow" || field === "allow")) current.rules.push({ type: field, path: value });
  }
  return groups;
}
function ruleMatches(pattern, urlPath) {
  if (pattern === "") return false;
  let rx = "^";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*") rx += ".*";
    else if (c === "$" && i === pattern.length - 1) rx += "$";
    else rx += c.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  try { return new RegExp(rx).test(urlPath); } catch { return false; }
}
function isAllowed(groups, urlPath, ua) {
  ua = ua.toLowerCase();
  const exact = groups.find((g) => g.agents.some((a) => a === ua));
  const star  = groups.find((g) => g.agents.includes("*"));
  const g = exact || star;
  if (!g) return { allowed: true, reason: "no matching group" };
  let best = null;
  for (const r of g.rules) {
    if (ruleMatches(r.path, urlPath)) {
      if (!best || r.path.length > best.path.length) best = { ...r };
    }
  }
  if (!best) return { allowed: true, reason: "no matching rule" };
  return { allowed: best.type === "allow", reason: `${best.type === "allow" ? "Allow" : "Disallow"}: ${best.path}` };
}

const verdicts = [];
for (const mcp of mcps) {
  const r = byOrigin[mcp.origin];
  let verdict, reason;
  if (!r || r.error) { verdict = "fetch_error"; reason = `robots.txt fetch failed: ${r?.error || "unknown"}`; }
  else if (r.status === 404 || r.status === 410 || (r.body || "").trim() === "") { verdict = "allowed"; reason = `no robots.txt (status ${r.status})`; }
  else if (r.status !== 200) { verdict = "fetch_error"; reason = `robots.txt returned status ${r.status}`; }
  else {
    const groups = parseRobots(r.body);
    const d = isAllowed(groups, mcp.searchPath, "BabageMedBot");
    verdict = d.allowed ? "allowed" : "blocked";
    reason  = d.reason;
  }
  verdicts.push({ id: mcp.id, origin: mcp.origin, searchUrl: mcp.searchUrl, searchPath: mcp.searchPath, verdict, reason });
}

// ── 4. Decide removals ─────────────────────────────────────────────────────
const remove = verdicts.filter((v) => v.verdict !== "allowed").map((v) => v.id);
const allowed = verdicts.filter((v) => v.verdict === "allowed");
console.log(`re-audit verdict: allowed=${allowed.length} blocked=${verdicts.filter(v=>v.verdict==='blocked').length} errors=${verdicts.filter(v=>v.verdict==='fetch_error').length}`);

if (remove.length === 0) {
  console.log("No additional removals needed — repo already clean.");
  fs.writeFileSync(path.join(ROOT, "scripts/reaudit-report.json"), JSON.stringify({ generatedAt: new Date().toISOString(), totals: { audited: mcps.length, removed: 0 }, verdicts }, null, 2));
  process.exit(0);
}
console.log("Removing:", remove.join(", "));
const removeSet = new Set(remove);

// ── 5. Delete + patch registries (same as delete-blocked-mcps.mjs) ─────────
let dirsGone = 0;
for (const id of remove) {
  const dir = path.join(ROOT, "mcps", id);
  if (fs.existsSync(dir)) { fs.rmSync(dir, { recursive: true, force: true }); dirsGone++; }
}
console.log(`  removed ${dirsGone} mcps/ directories`);

const allPath = path.join(ROOT, "infra/helm/babagemed/mcps-all.txt");
const allTokens = fs.readFileSync(allPath, "utf8").split(/\s+/).filter(Boolean);
const allKept = allTokens.filter((t) => !removeSet.has(t));
fs.writeFileSync(allPath, allKept.join(" ") + "\n");
console.log(`  mcps-all.txt: ${allTokens.length} -> ${allKept.length}`);

const indexPath = path.join(ROOT, "infra/helm/babagemed/mcps-index.json");
const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
let idxRemoved = 0;
for (const id of Object.keys(index.byId)) {
  if (removeSet.has(id)) { delete index.byId[id]; idxRemoved++; }
}
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");
console.log(`  mcps-index.json: removed ${idxRemoved}`);

const tplPath = path.join(ROOT, "infra/helm/babagemed/templates/_helpers.tpl");
let tpl = fs.readFileSync(tplPath, "utf8");
tpl = tpl.replace(
  /(\{\{-\s*else if eq \.Values\.mcps\.preset\s+"default"\s*-\}\}\s*\n)([^\n]+)/,
  (_match, header, line) => {
    const filtered = line.split(/\s+/).filter(Boolean).filter((t) => !removeSet.has(t));
    return header + filtered.join(" ");
  }
);
fs.writeFileSync(tplPath, tpl);

const manPath = path.join(ROOT, "scripts/mcps.manifest.json");
const man = JSON.parse(fs.readFileSync(manPath, "utf8"));
const before = man.servers.length;
man.servers = man.servers.filter((s) => !removeSet.has(s.id));
fs.writeFileSync(manPath, JSON.stringify(man, null, 2) + "\n");
console.log(`  mcps.manifest.json: ${before} -> ${man.servers.length}`);

const composePath = path.join(ROOT, "docker-compose.mcps.yml");
const compose = fs.readFileSync(composePath, "utf8");
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

const iconPath = path.join(ROOT, "frontend/app/components/ConnectorIcon.tsx");
if (fs.existsSync(iconPath)) {
  let icon = fs.readFileSync(iconPath, "utf8");
  for (const id of remove) {
    const rx = new RegExp(`\\n\\s*${id.replace(/[-/.]/g, "\\$&")}:\\s*"[^"]*",`, "g");
    icon = icon.replace(rx, "");
  }
  fs.writeFileSync(iconPath, icon);
}

fs.writeFileSync(path.join(ROOT, "scripts/reaudit-report.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  totals: { audited: mcps.length, removed: remove.length, remaining: allKept.length },
  removedIds: remove,
  verdicts,
}, null, 2));
console.log(`\nDone. Removed ${remove.length}, remaining ${allKept.length}.`);
