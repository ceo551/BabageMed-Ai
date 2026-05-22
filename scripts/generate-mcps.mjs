#!/usr/bin/env node
// Generates a Dockerized TypeScript MCP server for every entry in mcps.manifest.json.
// Idempotent: existing per-server tools.ts is preserved (only re-writes scaffold files).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MANIFEST = JSON.parse(readFileSync(join(__dirname, "mcps.manifest.json"), "utf8"));

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
  // Build context = repo root (see docker-compose.mcps.yml). All paths are repo-root-relative.
  const common = `# Build stage — context is repo root
FROM node:20-bookworm-slim AS build
WORKDIR /build
# Copy shared base package first so its layer caches
COPY packages/mcp-base/package.json packages/mcp-base/tsconfig.json /build/packages/mcp-base/
COPY packages/mcp-base/src /build/packages/mcp-base/src
RUN cd /build/packages/mcp-base && npm install --no-audit --no-fund && npx tsc -p tsconfig.json
# Copy this MCP's source
WORKDIR /build/mcp
COPY mcps/${s.id}/package.json mcps/${s.id}/tsconfig.json ./
COPY mcps/${s.id}/src ./src
# Optional shared helpers (Google OAuth) used by gmail/gcal/gdrive
COPY mcps/_shared /build/mcps/_shared
RUN npm install --no-audit --no-fund && npx tsc -p tsconfig.json
`;
  return needsBrowser
    ? `${common}
FROM mcr.microsoft.com/playwright:v1.49.0-jammy
WORKDIR /app
ENV NODE_ENV=production HTTP_ONLY=1
COPY --from=build /build/mcp /app
COPY --from=build /build/packages/mcp-base /app/node_modules/@babagemed/mcp-base
COPY --from=build /build/mcps/_shared /app/_shared
EXPOSE ${s.port}
CMD ["node", "dist/index.js"]
`
    : `${common}
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HTTP_ONLY=1
COPY --from=build /build/mcp /app
COPY --from=build /build/packages/mcp-base /app/node_modules/@babagemed/mcp-base
COPY --from=build /build/mcps/_shared /app/_shared
EXPOSE ${s.port}
USER node
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
  // scrape default
  return `import { z, McpServer, Scraper, cheerioLoad } from "@babagemed/mcp-base";

const scraper = new Scraper({
  base: ${JSON.stringify(s.base)},
  userAgent: process.env.SCRAPER_USER_AGENT,
  rps: Number(process.env.SCRAPER_RATE_RPS || 1),
  timeoutMs: Number(process.env.SCRAPER_TIMEOUT_MS || 30000),
  headless: (process.env.SCRAPER_HEADLESS ?? "true") !== "false",
  cacheTtlSec: Number(process.env.SCRAPER_CACHE_TTL_SEC || 86400),
  proxyUrl: process.env.SCRAPER_PROXY_URL || undefined,
  blockMedia: true,
});

export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: ${JSON.stringify(`Search ${s.name} for a query and return links + snippets.`)},
    input: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(50).optional() }),
    handler: async ({ query, limit = 10 }) => {
      const url = ${JSON.stringify(s.base)} + "/?s=" + encodeURIComponent(query);
      const r = await scraper.fetchHtml(url, { browser: false });
      const $ = r.$;
      const results: { title: string; url: string; snippet: string }[] = [];
      $("a").each((_, a) => {
        const href = $(a).attr("href") || "";
        const text = $(a).text().trim();
        if (!href || !text || text.length < 8) return;
        if (results.length >= limit) return;
        try {
          const abs = new URL(href, ${JSON.stringify(s.base)}).toString();
          if (!abs.startsWith(${JSON.stringify(new URL(s.base).origin)})) return;
          if (results.some(x => x.url === abs)) return;
          results.push({ title: text.slice(0, 200), url: abs, snippet: "" });
        } catch {}
      });
      return { source: ${JSON.stringify(s.id)}, query, count: results.length, results };
    },
  });

  server.tool({
    name: "fetch",
    description: ${JSON.stringify(`Fetch a ${s.name} page and return cleaned text content.`)},
    input: z.object({ url: z.string().url() }),
    handler: async ({ url }) => {
      const r = await scraper.fetchHtml(url, { browser: false });
      const $ = r.$;
      $("script,style,nav,footer,header,form,iframe,aside").remove();
      const title = $("h1").first().text().trim() || $("title").text().trim();
      const text = $("main, article, .content, #content, body").first().text().replace(/\\s+/g, " ").trim().slice(0, 12000);
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
  wIfMissing(join(dir, "src", "tools.ts"), fallbackTools(s));
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
compose.push("    external: true");
w(join(ROOT, "docker-compose.mcps.yml"), compose.join("\n"));

console.log(`generated ${written} MCP servers`);
