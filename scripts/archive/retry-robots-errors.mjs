#!/usr/bin/env node
// Retry the origins that previously errored, with longer timeout + 2 attempts,
// and re-decide blocked/allowed using the same parser.
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const report = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/robots-report.json"), "utf8"));

const errs = report.mcps.filter((m) => m.verdict === "fetch_error");
const origins = [...new Set(errs.map((m) => m.origin))];
console.log(`retrying ${origins.length} origins…`);

const UA = "Mozilla/5.0 (compatible; PervagansBot/1.0; +https://babagemed.com)";

function fetchOnce(url, timeout) {
  return new Promise((resolve) => {
    let u; try { u = new URL(url); } catch { return resolve({ status: 0, error: "bad-url" }); }
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request(u, {
      method: "GET",
      headers: { "User-Agent": UA, "Accept": "text/plain,*/*" },
      timeout,
    }, (res) => {
      if ([301,302,307,308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        try { return resolve(fetchOnce(new URL(res.headers.location, u).toString(), timeout)); } catch {}
      }
      let buf = "";
      res.setEncoding("utf8");
      res.on("data", (c) => { if (buf.length < 200_000) buf += c; });
      res.on("end", () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, error: "timeout" }); });
    req.on("error", (e) => resolve({ status: 0, error: e.code || e.message }));
    req.end();
  });
}
function hard(p, ms, label) {
  return Promise.race([p, new Promise((r) => setTimeout(() => r({ status: 0, error: `hard-timeout ${label}` }), ms))]);
}

async function tryOrigin(origin) {
  // up to 2 attempts, 25s each
  for (let i = 0; i < 2; i++) {
    const r = await hard(fetchOnce(new URL("/robots.txt", origin).toString(), 25000), 30000, origin);
    if (r.status > 0) return r;
  }
  return { status: 0, error: "all-attempts-failed" };
}

async function pool(items, n, w) {
  let i = 0; const out = new Array(items.length);
  await Promise.all(Array.from({length:n}, async () => {
    while (true) { const idx = i++; if (idx >= items.length) return; out[idx] = await w(items[idx], idx); }
  }));
  return out;
}

let done = 0;
const results = await pool(origins, 12, async (origin) => {
  const r = await tryOrigin(origin);
  done++; if (done % 5 === 0) process.stdout.write(`[${done}/${origins.length}]`);
  return [origin, r];
});
process.stdout.write("\n");
const byOrigin = Object.fromEntries(results);

// Same parser as audit-robots.mjs
function parseRobots(body) {
  const groups = []; let current = null;
  for (let raw of body.split(/\r?\n/)) {
    raw = raw.replace(/#.*$/, "").trim();
    if (!raw) continue;
    const m = raw.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const field = m[1].toLowerCase(), value = m[2].trim();
    if (field === "user-agent") {
      if (!current || current.rules.length > 0) { current = { agents: [value.toLowerCase()], rules: [] }; groups.push(current); }
      else current.agents.push(value.toLowerCase());
    } else if (current && (field === "disallow" || field === "allow")) {
      current.rules.push({ type: field, path: value });
    }
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

// Re-evaluate each errored MCP
let stillErr = 0, nowBlocked = 0, nowAllowed = 0;
for (const m of errs) {
  const r = byOrigin[m.origin];
  if (!r) continue;
  if (r.error) { m.verdict = "fetch_error"; m.reason = `robots.txt fetch failed: ${r.error}`; stillErr++; continue; }
  if (r.status === 404 || r.status === 410 || (r.body || "").trim() === "") {
    m.verdict = "allowed"; m.reason = `no robots.txt (status ${r.status})`; nowAllowed++; continue;
  }
  if (r.status !== 200) { m.verdict = "fetch_error"; m.reason = `robots.txt returned status ${r.status}`; stillErr++; continue; }
  const groups = parseRobots(r.body);
  const d = isAllowed(groups, m.probePath, "PervagansBot");
  m.verdict = d.allowed ? "allowed" : "blocked";
  m.reason  = d.reason;
  if (d.allowed) nowAllowed++; else nowBlocked++;
}

// Recompute totals across the whole report
const totals = { total: report.mcps.length, allowed: 0, blocked: 0, errors: 0 };
for (const m of report.mcps) {
  if (m.verdict === "allowed") totals.allowed++;
  else if (m.verdict === "blocked") totals.blocked++;
  else totals.errors++;
}
report.totals = totals;
report.generatedAt = new Date().toISOString();
fs.writeFileSync(path.join(ROOT, "scripts/robots-report.json"), JSON.stringify(report, null, 2));

const blocked = report.mcps.filter((m) => m.verdict === "blocked").map((m) => `${m.id}\t${m.reason}\t${m.origin}`);
const errors  = report.mcps.filter((m) => m.verdict === "fetch_error").map((m) => `${m.id}\t${m.reason}\t${m.origin}`);
fs.writeFileSync(path.join(ROOT, "scripts/robots-blocked.txt"), blocked.join("\n") + "\n");
fs.writeFileSync(path.join(ROOT, "scripts/robots-errors.txt"),  errors.join("\n") + "\n");

console.log(`retry done — recovered: allowed=${nowAllowed} blocked=${nowBlocked} stillErr=${stillErr}`);
console.log(`new totals: allowed=${totals.allowed} blocked=${totals.blocked} errors=${totals.errors}`);
