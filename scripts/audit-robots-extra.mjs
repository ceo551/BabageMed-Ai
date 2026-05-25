#!/usr/bin/env node
// Audit the 47 scraping MCPs that use an inline URL string instead of a
// SEARCH_URL constant. Reuses the same robots.txt parser as audit-robots.mjs
// and merges results into scripts/robots-report.json.
import fs from "node:fs"; import path from "node:path"; import https from "node:https"; import http from "node:http";
const ROOT = process.cwd();
const MCPS = path.join(ROOT, "mcps");

const all = fs.readdirSync(MCPS, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_") && !d.name.startsWith("."))
  .map((d) => d.name);

const extras = [];
for (const id of all) {
  const tp = path.join(MCPS, id, "src", "tools.ts");
  if (!fs.existsSync(tp)) continue;
  const src = fs.readFileSync(tp, "utf8");
  if (/SEARCH_URL\s*=/.test(src)) continue;
  const usesScraper = /new Scraper\(/.test(src) || /scraper\.fetchHtml/.test(src);
  if (!usesScraper) continue;
  // Find the URL string with {q} placeholder used inside the search handler.
  // Patterns we accept:
  //   const url = "https://…{q}…";
  //   scraper.fetchHtml("https://…{q}…", …)
  //   const url = `https://…?q=${…}`;   (rarer)
  let searchUrl = null;
  const m1 = src.match(/"(https?:\/\/[^"]*\{q\}[^"]*)"/);
  if (m1) searchUrl = m1[1];
  if (!searchUrl) {
    const m2 = src.match(/`(https?:\/\/[^`]*\$\{[^`]*\}[^`]*)`/);
    if (m2) searchUrl = m2[1].replace(/\$\{[^}]*\}/g, "test");
  }
  if (!searchUrl) {
    // Fallback: any same-origin URL inside fetchHtml — use base + /search
    const baseM = src.match(/base:\s*"([^"]+)"/);
    if (baseM) searchUrl = baseM[1].replace(/\/$/, "") + "/search?q=test";
  }
  if (!searchUrl) continue;
  let origin = ""; try { origin = new URL(searchUrl.replace(/\{q\}/g, "test")).origin; } catch {}
  if (!origin || !/^https?:/i.test(origin)) continue;
  extras.push({ id, searchUrl, origin });
}
console.log(`extra scraping MCPs to audit: ${extras.length}`);

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

const origins = [...new Set(extras.map((m) => m.origin))];
let done = 0;
const results = await pool(origins, 16, async (origin) => {
  const r = await tryOrigin(origin);
  done++; if (done % 5 === 0) process.stdout.write(`[${done}/${origins.length}]`);
  return [origin, r];
});
process.stdout.write("\n");
const byOrigin = Object.fromEntries(results);

// Merge into the existing report
const reportPath = path.join(ROOT, "scripts/robots-report.json");
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
for (const e of extras) {
  const r = byOrigin[e.origin];
  const probeUrl = e.searchUrl.replace(/\{q\}/g, "test");
  let urlPath; try { const u = new URL(probeUrl); urlPath = u.pathname + (u.search || ""); } catch { urlPath = "/"; }
  let verdict, reason;
  if (!r || r.error) { verdict = "fetch_error"; reason = `robots.txt fetch failed: ${r?.error || "unknown"}`; }
  else if (r.status === 404 || r.status === 410 || (r.body || "").trim() === "") { verdict = "allowed"; reason = `no robots.txt (status ${r.status})`; }
  else if (r.status !== 200) { verdict = "fetch_error"; reason = `robots.txt returned status ${r.status}`; }
  else { const d = isAllowed(parseRobots(r.body), urlPath, "BabageMedBot"); verdict = d.allowed ? "allowed" : "blocked"; reason = d.reason; }
  // If the MCP is already in the report, update it; otherwise append.
  const existing = report.mcps.find((m) => m.id === e.id);
  if (existing) Object.assign(existing, { origin: e.origin, searchUrl: e.searchUrl, probePath: urlPath, verdict, reason });
  else report.mcps.push({ id: e.id, origin: e.origin, searchUrl: e.searchUrl, probePath: urlPath, verdict, reason });
}

const totals = { total: report.mcps.length, allowed: 0, blocked: 0, errors: 0 };
for (const m of report.mcps) {
  if (m.verdict === "allowed") totals.allowed++;
  else if (m.verdict === "blocked") totals.blocked++;
  else totals.errors++;
}
report.totals = totals;
report.generatedAt = new Date().toISOString();
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

const blocked = report.mcps.filter((m) => m.verdict === "blocked").map((m) => `${m.id}\t${m.reason}\t${m.origin}`);
const errors  = report.mcps.filter((m) => m.verdict === "fetch_error").map((m) => `${m.id}\t${m.reason}\t${m.origin}`);
fs.writeFileSync(path.join(ROOT, "scripts/robots-blocked.txt"), blocked.join("\n") + "\n");
fs.writeFileSync(path.join(ROOT, "scripts/robots-errors.txt"),  errors.join("\n") + "\n");
console.log(`merged. totals: allowed=${totals.allowed} blocked=${totals.blocked} errors=${totals.errors} total=${totals.total}`);
