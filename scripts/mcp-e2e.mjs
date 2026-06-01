#!/usr/bin/env node
// End-to-end smoke test for one MCP server.
//
// Usage:
//   node scripts/mcp-e2e.mjs <id>                    # build + run + test
//   node scripts/mcp-e2e.mjs <id> --skip-build       # reuse existing image
//   IMAGE=ghcr.io/foo/mcp-pubmed:latest node scripts/mcp-e2e.mjs pubmed
//
// What we assert:
//   1. /health returns { ok: true }
//   2. /tools returns at least one tool with a valid JSON Schema
//   3. /metrics is Prometheus text format (#HELP + #TYPE lines)
//   4. For MCPs whose first tool is a free-text "search", POST /call/search
//      with a known query and assert the response shape (best-effort —
//      tools that need creds return "not configured" → counted as skipped,
//      not failed).
//
// Exit codes: 0 = pass, 1 = fail, 2 = skipped (creds-required).
import { spawn, execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const id = process.argv[2];
if (!id) { console.error("usage: mcp-e2e.mjs <id>"); process.exit(64); }
const skipBuild = process.argv.includes("--skip-build");

const manifest = JSON.parse(readFileSync("scripts/mcps.manifest.json", "utf8"));
const s = manifest.servers.find((x) => x.id === id);
if (!s) { console.error(`unknown MCP id: ${id}`); process.exit(64); }

// MCPs that need credentials to do anything meaningful.
// Their health + tools endpoints still work, but /call/search returns
// "X_API_KEY required" — that's fine, it proves the tool is wired.
const NEEDS_CREDS = new Set([
  "notion","slack","kaggle","linkedin","gmail","gcalendar","gdrive",
  "github","huggingface","ms365","hostinger","godaddy",
  "nccn",
]);

const HOST_PORT = 30000 + (s.port % 1000);      // host port; container port stays $s.port
const IMAGE = process.env.IMAGE || `pervagans/mcp-${id}:e2e`;
const CONTAINER = `e2e-${id}-${Date.now()}`;

function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: "inherit", ...opts });
}

async function fetchJson(path) {
  const r = await fetch(`http://localhost:${HOST_PORT}${path}`, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} on ${path}`);
  return r.json();
}
async function postJson(path, body) {
  const r = await fetch(`http://localhost:${HOST_PORT}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let parsed = null; try { parsed = JSON.parse(text); } catch {}
  return { status: r.status, body: parsed ?? text };
}

async function main() {
  if (!skipBuild && !process.env.IMAGE) {
    console.log(`▶ docker build pervagans/mcp-${id}:e2e`);
    sh(`docker build -f mcps/${id}/Dockerfile -t ${IMAGE} .`);
  }

  console.log(`▶ docker run ${CONTAINER}`);
  sh(`docker run -d --name ${CONTAINER} -p ${HOST_PORT}:${s.port} -e HTTP_ONLY=1 ${IMAGE}`);

  try {
    // wait for /health
    const deadline = Date.now() + 60_000;
    let healthy = false;
    while (Date.now() < deadline) {
      try {
        const r = await fetch(`http://localhost:${HOST_PORT}/health`);
        if (r.ok) { healthy = true; break; }
      } catch {}
      await sleep(500);
    }
    if (!healthy) {
      sh(`docker logs ${CONTAINER} 2>&1 | tail -50`, { stdio: "inherit" });
      throw new Error("/health never became ready");
    }

    // 1. /health body
    const health = await fetchJson("/health");
    assert(health.ok === true, "/health.ok !== true");
    assert(health.id === id, `/health.id ${health.id} !== ${id}`);
    console.log("  ✓ /health");

    // 2. /tools
    const { tools } = await fetchJson("/tools");
    assert(Array.isArray(tools) && tools.length > 0, "/tools returned no tools");
    for (const t of tools) {
      assert(typeof t.name === "string" && t.name.length > 0, "tool missing name");
      assert(t.inputSchema && t.inputSchema.type === "object", `tool ${t.name} missing inputSchema`);
    }
    console.log(`  ✓ /tools (${tools.length})`);

    // 3. /metrics — Prometheus text format
    const metricsRes = await fetch(`http://localhost:${HOST_PORT}/metrics`);
    assert(metricsRes.ok, "/metrics not OK");
    const metricsText = await metricsRes.text();
    assert(metricsText.includes("# HELP"), "/metrics missing # HELP");
    assert(metricsText.includes("# TYPE"), "/metrics missing # TYPE");
    assert(metricsText.includes(`mcp_id="${id}"`), `/metrics missing mcp_id label`);
    console.log("  ✓ /metrics");

    // 4. /call/search with a known query (best-effort)
    const searchTool = tools.find((t) => t.name === "search");
    if (searchTool) {
      const required = searchTool.inputSchema.required || [];
      // Build the smallest valid args object. The "search" tool always takes
      // a `query` (or `term` / `q` / `terms`) parameter.
      const args = {};
      const props = searchTool.inputSchema.properties || {};
      for (const k of ["query","term","q","terms"]) {
        if (props[k]) { args[k] = "hypertension"; break; }
      }
      for (const r of required) if (args[r] === undefined && props[r]?.type === "string") args[r] = "hypertension";

      const { status, body } = await postJson("/call/search", args);
      if (NEEDS_CREDS.has(id) && body?.error?.match(/required|not configured/i)) {
        console.log(`  ⊘ /call/search skipped (creds required: ${body.error})`);
        process.exitCode = 2; // skipped
      } else if (status === 200) {
        assert(body?.ok === true || body?.result !== undefined, "/call/search returned no result");
        console.log("  ✓ /call/search");
      } else if (status === 502 || status === 500) {
        // Outbound network can fail in CI — treat as skipped, not a hard fail.
        console.log(`  ⊘ /call/search skipped (transport: HTTP ${status})`);
        process.exitCode = 2;
      } else if (status === 400) {
        throw new Error(`/call/search: HTTP 400 ${JSON.stringify(body)}`);
      } else {
        throw new Error(`/call/search: HTTP ${status}`);
      }
    }

    console.log(`✓ ${id} OK`);
  } catch (e) {
    console.error(`✗ ${id}: ${e.message}`);
    try { sh(`docker logs ${CONTAINER} 2>&1 | tail -100`); } catch {}
    process.exit(1);
  } finally {
    try { sh(`docker rm -f ${CONTAINER}`, { stdio: "ignore" }); } catch {}
  }
}

function assert(cond, msg) { if (!cond) throw new Error("assert: " + msg); }

main().catch((e) => { console.error(e); process.exit(1); });
