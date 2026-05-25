#!/usr/bin/env node
// Audit script: walk every MCP, extract its SEARCH_URL + origin,
// fetch /robots.txt per origin (with parallel pool + caching),
// then decide for every MCP whether its search path is blocked.
//
// Output: a JSON report at scripts/robots-report.json plus a human summary.
// Does NOT delete anything — deletion is a separate step the user reviews.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";
import http from "node:http";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, "..");
const MCPS_DIR   = path.join(ROOT, "mcps");

// ---- Step 1: enumerate every MCP that has a SEARCH_URL ----------------------
const mcpDirs = fs.readdirSync(MCPS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_") && !d.name.startsWith("."))
  .map((d) => d.name);

const mcps = [];
for (const id of mcpDirs) {
  const toolsPath = path.join(MCPS_DIR, id, "src", "tools.ts");
  if (!fs.existsSync(toolsPath)) continue;
  const src = fs.readFileSync(toolsPath, "utf8");
  // pattern: const SEARCH_URL  = "https://..."
  const m = src.match(/SEARCH_URL\s*=\s*"([^"]+)"/);
  const b = src.match(/base:\s*"([^"]+)"/);
  if (!m) continue;                       // skip non-scraping MCPs (api-driven etc.)
  const searchUrl = m[1];
  let origin = "";
  try { origin = new URL(searchUrl).origin; } catch { /* skip bad URL */ }
  if (!origin) continue;
  mcps.push({ id, base: b?.[1] || origin, searchUrl, origin });
}

console.log(`[1/4] enumerated ${mcps.length} scraping-driven MCPs`);

// ---- Step 2: fetch /robots.txt per distinct origin --------------------------
const origins = [...new Set(mcps.map((m) => m.origin))];
console.log(`[2/4] ${origins.length} distinct origins to query`);

const UA = "BabageMedBot/1.0 (+https://babagemed.com)";
const TIMEOUT_MS = 12000;

function fetchRobots(origin) {
  return new Promise((resolve) => {
    const u = new URL("/robots.txt", origin);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request(
      u,
      {
        method: "GET",
        headers: { "User-Agent": UA, "Accept": "text/plain,*/*" },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        // follow one redirect (common: http→https, /robots.txt→/robots)
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          try {
            const next = new URL(res.headers.location, u).toString();
            res.resume();
            return resolve(fetchOnce(next));
          } catch { /* fall through */ }
        }
        let buf = "";
        res.setEncoding("utf8");
        res.on("data", (c) => { if (buf.length < 200_000) buf += c; });
        res.on("end", () => resolve({ status: res.statusCode, body: buf }));
      }
    );
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, body: "", error: "timeout" }); });
    req.on("error", (e) => resolve({ status: 0, body: "", error: e.code || e.message }));
    req.end();
  });
}
function fetchOnce(url) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request(
      u,
      { method: "GET", headers: { "User-Agent": UA }, timeout: TIMEOUT_MS },
      (res) => {
        let buf = "";
        res.setEncoding("utf8");
        res.on("data", (c) => { if (buf.length < 200_000) buf += c; });
        res.on("end", () => resolve({ status: res.statusCode, body: buf }));
      }
    );
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, body: "", error: "timeout" }); });
    req.on("error", (e) => resolve({ status: 0, body: "", error: e.code || e.message }));
    req.end();
  });
}

async function pool(items, n, worker) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (true) {
        const idx = i++;
        if (idx >= items.length) return;
        out[idx] = await worker(items[idx], idx);
      }
    })
  );
  return out;
}

function withHardTimeout(p, ms, label) {
  return Promise.race([
    p,
    new Promise((resolve) => setTimeout(() => resolve({ status: 0, body: "", error: `hard-timeout ${ms}ms ${label}` }), ms)),
  ]);
}
let done = 0;
const robotsResults = await pool(origins, 32, async (origin, idx) => {
  const r = await withHardTimeout(fetchRobots(origin), 15000, origin);
  done++;
  if (done % 20 === 0) process.stdout.write(`[${done}/${origins.length}]`);
  return [origin, r];
});
process.stdout.write("\n");
const robotsByOrigin = Object.fromEntries(robotsResults);

// ---- Step 3: parse robots.txt and decide blocked/allowed per MCP ------------
// Minimal robots.txt parser that honours user-agent groups + Allow/Disallow.
// Reference: https://www.rfc-editor.org/rfc/rfc9309
function parseRobots(body) {
  const groups = [];
  let current = null;
  const lines = body.split(/\r?\n/);
  for (let raw of lines) {
    raw = raw.replace(/#.*$/, "").trim();
    if (!raw) continue;
    const m = raw.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === "user-agent") {
      // If previous group only had user-agent lines, keep adding agents.
      if (!current || current.rules.length > 0) {
        current = { agents: [value.toLowerCase()], rules: [] };
        groups.push(current);
      } else {
        current.agents.push(value.toLowerCase());
      }
    } else if (current && (field === "disallow" || field === "allow")) {
      current.rules.push({ type: field, path: value });
    }
  }
  return groups;
}

function ruleMatches(pattern, urlPath) {
  // robots.txt path matching: '*' = wildcard, '$' = end-of-line anchor.
  if (pattern === "") return false;       // empty Disallow == allow all
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
  // Pick the most-specific user-agent group (exact match > '*').
  ua = ua.toLowerCase();
  const exact = groups.find((g) => g.agents.some((a) => a === ua));
  const star  = groups.find((g) => g.agents.includes("*"));
  const g = exact || star;
  if (!g) return { allowed: true, reason: "no matching group" };
  let best = null; // {type, path, len}
  for (const r of g.rules) {
    if (ruleMatches(r.path, urlPath)) {
      if (!best || r.path.length > best.path.length) best = { ...r };
    }
  }
  if (!best) return { allowed: true, reason: "no matching rule" };
  return {
    allowed: best.type === "allow",
    reason: `${best.type === "allow" ? "Allow" : "Disallow"}: ${best.path}`,
  };
}

const report = [];
let blockedCount = 0, allowedCount = 0, errorCount = 0;
for (const mcp of mcps) {
  const r = robotsByOrigin[mcp.origin];
  // Replace {q} so the URL parses cleanly, then take pathname+search.
  const probeUrl = mcp.searchUrl.replace(/\{q\}/g, "test");
  let urlPath;
  try { const u = new URL(probeUrl); urlPath = u.pathname + (u.search || ""); }
  catch { urlPath = "/"; }
  let verdict, reason;
  if (!r || r.error) {
    verdict = "fetch_error";
    reason  = `robots.txt fetch failed: ${r?.error || "unknown"}`;
    errorCount++;
  } else if (r.status === 404 || r.status === 410 || (r.body || "").trim() === "") {
    // No robots.txt → permissive by spec
    verdict = "allowed";
    reason  = `no robots.txt (status ${r.status})`;
    allowedCount++;
  } else if (r.status !== 200) {
    verdict = "fetch_error";
    reason  = `robots.txt returned status ${r.status}`;
    errorCount++;
  } else {
    const groups = parseRobots(r.body);
    const decision = isAllowed(groups, urlPath, "BabageMedBot");
    verdict = decision.allowed ? "allowed" : "blocked";
    reason  = decision.reason;
    if (decision.allowed) allowedCount++; else blockedCount++;
  }
  report.push({ id: mcp.id, origin: mcp.origin, searchUrl: mcp.searchUrl, probePath: urlPath, verdict, reason });
}

const outPath = path.join(ROOT, "scripts", "robots-report.json");
fs.writeFileSync(outPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  totals: { total: mcps.length, allowed: allowedCount, blocked: blockedCount, errors: errorCount },
  mcps: report,
}, null, 2));
console.log(`[3/4] verdicts written to ${path.relative(ROOT, outPath)}`);
console.log(`         allowed: ${allowedCount}   blocked: ${blockedCount}   errors: ${errorCount}`);

// Quick blocked-list print
const blocked = report.filter((r) => r.verdict === "blocked").map((r) => `${r.id}\t${r.reason}\t${r.origin}`);
const errors  = report.filter((r) => r.verdict === "fetch_error").map((r) => `${r.id}\t${r.reason}\t${r.origin}`);
fs.writeFileSync(path.join(ROOT, "scripts", "robots-blocked.txt"), blocked.join("\n") + "\n");
fs.writeFileSync(path.join(ROOT, "scripts", "robots-errors.txt"),  errors.join("\n") + "\n");
console.log(`[4/4] blocked list -> scripts/robots-blocked.txt   errors -> scripts/robots-errors.txt`);
