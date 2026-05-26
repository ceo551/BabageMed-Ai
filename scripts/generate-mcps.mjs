#!/usr/bin/env node
// Generates a Dockerized TypeScript MCP server for every entry in mcps.manifest.json.
// Idempotent: existing per-server tools.ts is preserved (only re-writes scaffold files).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MANIFEST = JSON.parse(readFileSync(join(__dirname, "mcps.manifest.json"), "utf8"));
const PATTERNS = JSON.parse(readFileSync(join(__dirname, "site-search-patterns.json"), "utf8"));

function resolvePattern(id, base) {
  const def = PATTERNS.defaults || {};
  let p = PATTERNS.patterns?.[id] || {};
  // Chase $alias references (single level — patterns reference only the _* base presets).
  if (p.$alias) p = { ...PATTERNS.patterns[p.$alias], ...p };
  const merged = { ...def, ...p };
  // Substitute {base} placeholder in the search URL.
  if (merged.search) merged.search = merged.search.replace("{base}", base);
  return {
    search:  merged.search  || (base + "/?s={q}"),
    result:  merged.result  || def.result,
    title:   merged.title   || def.title,
    link:    merged.link    || def.link,
    snippet: merged.snippet || def.snippet,
  };
}

function w(p, body) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
}

function wIfMissing(p, body) {
  if (existsSync(p)) return;
  w(p, body);
}

function pkgJson(s) {
  return JSON.stringify(
    {
      name: `@babagemed/mcp-${s.id}`,
      version: "0.1.0",
      private: true,
      type: "module",
      main: "dist/index.js",
      scripts: {
        build: "tsc -p tsconfig.json",
        start: "node dist/index.js",
        dev: "tsx src/index.ts",
      },
      dependencies: {
        "@babagemed/mcp-base": "file:../../packages/mcp-base",
        zod: "^3.23.8",
        cheerio: "^1.0.0",
        undici: "^6.21.0",
        playwright: "^1.49.0",
      },
      devDependencies: {
        "@types/node": "^22.10.0",
        tsx: "^4.19.2",
        typescript: "^5.6.3",
      },
    },
    null,
    2
  );
}

function tsConfig() {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "Node16",
        moduleResolution: "Node16",
        lib: ["ES2022"],
        outDir: "dist",
        rootDir: "src",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        resolveJsonModule: true,
        declaration: false,
      },
      include: ["src/**/*"],
    },
    null,
    2
  );
}

function dockerfile(s) {
  const needsBrowser = s.kind === "scrape" || s.kind === "hybrid";
  // Build context = repo root (see docker-compose.mcps.yml). The MCP source is
  // placed at /build/mcps/<id>/ so its package.json "file:../../packages/mcp-base"
  // path resolves to /build/packages/mcp-base/ at install time.
  const common = `# Build stage — context is repo root
# NOTE: kept BuildKit-free (no \`# syntax=\` directive, no \`--mount=type=cache\`)
# so this Dockerfile builds on classic Docker engines too — e.g. ACR Tasks
# without explicit BuildKit opt-in.
FROM node:20-bookworm-slim AS build
WORKDIR /build
# Shared base — gets its own layer so it caches across all ${MANIFEST.servers.length} MCPs
COPY packages/mcp-base/package.json packages/mcp-base/tsconfig.json /build/packages/mcp-base/
COPY packages/mcp-base/src /build/packages/mcp-base/src
RUN \\
    cd /build/packages/mcp-base && npm install --no-audit --no-fund && npx tsc -p tsconfig.json
# This MCP — placed at /build/mcps/${s.id}/ so file:../../packages/mcp-base resolves
WORKDIR /build/mcps/${s.id}
COPY mcps/${s.id}/package.json mcps/${s.id}/tsconfig.json ./
COPY mcps/${s.id}/src ./src
# Shared helpers (e.g. Google OAuth) — pulled in by gmail/gcal/gdrive
COPY mcps/_shared /build/mcps/_shared
RUN \\
    npm install --no-audit --no-fund && npx tsc -p tsconfig.json
`;
  return needsBrowser
    ? `${common}
FROM mcr.microsoft.com/playwright:v1.49.0-jammy
WORKDIR /app
ENV NODE_ENV=production HTTP_ONLY=1
COPY --from=build /build/mcps/${s.id} /app
COPY --from=build /build/packages/mcp-base /app/node_modules/@babagemed/mcp-base
EXPOSE ${s.port}
# Drop privileges — the Playwright base image ships with a pwuser
# (uid 1000) for exactly this purpose. Without it the renderer + the
# Node parent both run as root inside the container, which combined
# with any code-injection path would give attackers a root shell.
USER pwuser
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\
  CMD node -e "fetch('http://localhost:${s.port}/health').then(r=>{r.arrayBuffer().finally(()=>process.exit(r.ok?0:1))}).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
`
    : `${common}
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HTTP_ONLY=1
COPY --from=build /build/mcps/${s.id} /app
COPY --from=build /build/packages/mcp-base /app/node_modules/@babagemed/mcp-base
EXPOSE ${s.port}
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\
  CMD node -e "fetch('http://localhost:${s.port}/health').then(r=>{r.arrayBuffer().finally(()=>process.exit(r.ok?0:1))}).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
`;
}

function indexTs(s) {
  return `import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: ${JSON.stringify(s.id)},
  name: ${JSON.stringify(s.name)},
  kind: ${JSON.stringify(s.kind)},
  category: ${JSON.stringify(s.category)},
  base: ${JSON.stringify(s.base)},
  port: ${s.port},
  version: "0.1.0",
});

registerTools(server);
server.run();
`;
}

// Generic fallback tools.ts (created only if no real implementation exists yet for that server).
function fallbackTools(s) {
  if (s.kind === "api" || s.kind === "hybrid") {
    return `import { z, McpServer, ApiClient } from "@babagemed/mcp-base";

const api = new ApiClient({
  base: ${JSON.stringify(s.base)},
  rps: Number(process.env.SCRAPER_RATE_RPS || 2),
  userAgent: process.env.SCRAPER_USER_AGENT,
});

export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: ${JSON.stringify(`Search ${s.name} for a free-text query.`)},
    input: z.object({ query: z.string().min(1).describe("Free-text query") }),
    handler: async ({ query }) => {
      // Default GET ?q=<query>. Override in a real implementation per source.
      return api.get<unknown>("", { q: query });
    },
  });
}
`;
  }
  // scrape default — uses per-site search URL + result selectors when available
  const pat = resolvePattern(s.id, s.base);
  // ORIGIN is used as a prefix-filter on result links. When the manifest
  // `base` includes a path (e.g. https://academic.oup.com/eurheartj for
  // an OUP journal), `new URL(...).origin` strips it, so the filter ends
  // up accepting any article on academic.oup.com — including sibling
  // journals — as a result of this MCP. Preserve the path when present
  // so the prefix actually constrains to the relevant section.
  let origin = "";
  if (s.base) {
    try {
      const baseUrl = new URL(s.base);
      origin = baseUrl.pathname && baseUrl.pathname !== "/"
        ? baseUrl.origin + baseUrl.pathname.replace(/\/+$/, "")
        : baseUrl.origin;
    } catch {
      origin = s.base; // best-effort, leave as-is for malformed entries
    }
  }
  return `import { z, McpServer, Scraper, cheerioLoad } from "@babagemed/mcp-base";

const scraper = new Scraper({
  base: ${JSON.stringify(s.base)},
  userAgent: process.env.SCRAPER_USER_AGENT,
  rps: Number(process.env.SCRAPER_RATE_RPS ?? 1) || 1,
  timeoutMs: Number(process.env.SCRAPER_TIMEOUT_MS || 30000),
  headless: (process.env.SCRAPER_HEADLESS ?? "true") !== "false",
  cacheTtlSec: Number(process.env.SCRAPER_CACHE_TTL_SEC || 86400),
  proxyUrl: process.env.SCRAPER_PROXY_URL || undefined,
  blockMedia: true,
});

// Source-specific search URL + result-row selectors (from scripts/site-search-patterns.json)
const SEARCH_URL  = ${JSON.stringify(pat.search)};
const SEL_RESULT  = ${JSON.stringify(pat.result)};
const SEL_TITLE   = ${JSON.stringify(pat.title)};
const SEL_LINK    = ${JSON.stringify(pat.link)};
const SEL_SNIPPET = ${JSON.stringify(pat.snippet)};
const ORIGIN      = ${JSON.stringify(origin)};

export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: ${JSON.stringify(`Search ${s.name} for a query and return structured results.`)},
    input: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(50).optional() }),
    handler: async ({ query, limit = 10 }) => {
      const url = SEARCH_URL.replace("{q}", encodeURIComponent(query));
      const r = await scraper.fetchHtml(url, { browser: false });
      const $ = r.$;
      const results: { title: string; url: string; snippet: string }[] = [];
      // Try the source-specific result selector first.
      $(SEL_RESULT).each((_, el) => {
        if (results.length >= limit) return false;
        const $row = $(el);
        const $link = $row.find(SEL_LINK).first();
        const href = $link.attr("href");
        if (!href) return;
        let abs: string;
        try { abs = new URL(href, ${JSON.stringify(s.base)}).toString(); } catch { return; }
        if (!abs.startsWith(ORIGIN)) return;
        if (results.some((x) => x.url === abs)) return;
        const title = ($row.find(SEL_TITLE).first().text() || $link.text() || "").trim();
        const snippet = $row.find(SEL_SNIPPET).first().text().trim().slice(0, 400);
        if (!title) return;
        results.push({ title: title.slice(0, 240), url: abs, snippet });
      });
      // Fallback: if the structured pass found nothing, harvest same-origin links.
      if (results.length === 0) {
        $("a").each((_, a) => {
          if (results.length >= limit) return false;
          const href = $(a).attr("href") || "";
          const text = $(a).text().trim();
          if (!href || text.length < 8) return;
          let abs: string;
          try { abs = new URL(href, ${JSON.stringify(s.base)}).toString(); } catch { return; }
          if (!abs.startsWith(ORIGIN)) return;
          if (results.some((x) => x.url === abs)) return;
          results.push({ title: text.slice(0, 240), url: abs, snippet: "" });
        });
      }
      return { source: ${JSON.stringify(s.id)}, query, searchUrl: url, count: results.length, results };
    },
  });

  server.tool({
    name: "fetch",
    description: ${JSON.stringify(`Fetch a ${s.name} page and return cleaned text content.`)},
    input: z.object({ url: z.string().url() }),
    handler: async ({ url }) => {
      // Friendlier rejection than the Scraper's bare "host not allowed".
      // Callers often paste a URL from a different site assuming any
      // fetch tool will work; surface the constraint explicitly.
      try {
        const u = new URL(url);
        const expected = new URL(${JSON.stringify(s.base || "about:blank")}).hostname;
        if (u.hostname !== expected && !u.hostname.endsWith("." + expected)) {
          return {
            error: "url not under this MCP's allowed host",
            allowedHost: expected,
            providedHost: u.hostname,
            hint: "Use the MCP whose base matches the URL host, or call the chrome MCP for cross-origin browsing.",
          };
        }
      } catch {
        return { error: "invalid url", url };
      }
      const r = await scraper.fetchHtml(url, { browser: false });
      const $ = r.$;
      $("script,style,nav,footer,header,form,iframe,aside,.ad,.advert,.related").remove();
      const title = $("h1").first().text().trim() || $("title").text().trim();
      const text  = $("main, article, .content, #content, .article, body").first().text().replace(/\\s+/g, " ").trim().slice(0, 20000);
      return { url: r.url, status: r.status, title, text };
    },
  });
}
`;
}

// Ensure shared dir exists (used by gmail/gcal/gdrive)
mkdirSync(join(ROOT, "mcps", "_shared", "src"), { recursive: true });
const sharedKeep = join(ROOT, "mcps", "_shared", ".keep");
if (!existsSync(sharedKeep)) w(sharedKeep, "");

let written = 0;
for (const s of MANIFEST.servers) {
  const dir = join(ROOT, "mcps", s.id);
  w(join(dir, "package.json"), pkgJson(s));
  w(join(dir, "tsconfig.json"), tsConfig());
  w(join(dir, "Dockerfile"), dockerfile(s));
  w(join(dir, "src", "index.ts"), indexTs(s));
  // tools.ts: skip if the file has either marker:
  //   "// @hand-edited"            — manual override
  //   "// @generated-by write-real-tools.mjs" — auto-generated rich
  //                                  template (only write-real-tools.mjs
  //                                  may refresh it)
  // Without this, running generate-mcps.mjs alone (without re-running
  // write-real-tools.mjs after) would wipe every real-API MCP back to
  // the fallback search/fetch shell.
  const toolsPath = join(dir, "src", "tools.ts");
  let preserve = false;
  if (existsSync(toolsPath)) {
    const cur = readFileSync(toolsPath, "utf8");
    preserve = cur.startsWith("// @hand-edited") || cur.startsWith("// @generated-by");
  }
  if (!preserve) w(toolsPath, fallbackTools(s));
  written++;
}

// docker-compose.mcps.yml fragment
const compose = ["# auto-generated by scripts/generate-mcps.mjs", "services:"];
for (const s of MANIFEST.servers) {
  compose.push(`  mcp-${s.id}:`);
  compose.push(`    build:`);
  compose.push(`      context: .`);
  compose.push(`      dockerfile: mcps/${s.id}/Dockerfile`);
  compose.push(`    image: babagemed/mcp-${s.id}:latest`);
  compose.push(`    env_file: .env`);
  compose.push(`    environment:`);
  compose.push(`      HTTP_ONLY: "1"`);
  compose.push(`      MCP_PORT: "${s.port}"`);
  compose.push(`    ports:`);
  compose.push(`      - "${s.port}:${s.port}"`);
  compose.push(`    restart: unless-stopped`);
  compose.push(`    networks: [babagemed]`);
}
compose.push("");
compose.push("networks:");
compose.push("  babagemed:");
compose.push("    name: babagemed");
compose.push("    driver: bridge");
w(join(ROOT, "docker-compose.mcps.yml"), compose.join("\n"));

// Regenerate mcps-all.txt for the Helm chart + CI sharding. The previous
// file was hand-maintained and silently drifted from the manifest.
const allTxt = MANIFEST.servers.map((s) => s.id).join(" ");
w(join(ROOT, "infra/helm/babagemed/mcps-all.txt"), allTxt + "\n");

// Also emit mcps-index.json (the chart consumes this for templating).
const indexJson = MANIFEST.servers.map((s) => ({ id: s.id, port: s.port, kind: s.kind, category: s.category }));
w(join(ROOT, "infra/helm/babagemed/mcps-index.json"), JSON.stringify(indexJson, null, 2) + "\n");

console.log(`generated ${written} MCP servers`);
