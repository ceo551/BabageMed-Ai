#!/usr/bin/env node
// Scaffolds the 223 Perplexity-style connector MCPs from
// scripts/perplexity-connectors.json. Each new entry gets:
//   - mcps/<id>/Dockerfile     (mirrors the pubmed/pattern, swapped name+port)
//   - mcps/<id>/package.json   (npm scope @pervagans/mcp-<id>)
//   - mcps/<id>/tsconfig.json  (identical)
//   - mcps/<id>/src/index.ts   (registers tools, runs on assigned port)
//   - mcps/<id>/src/tools.ts   (stub `search` + `fetch` that report "not yet
//                              configured" with the homepage URL — callers
//                              get a real, typed response shape instead of
//                              a network error so the LLM stays grounded)
// and appends entries to:
//   - scripts/mcps.manifest.json
//   - infra/helm/pervagans/mcps-all.txt
//   - infra/helm/pervagans/mcps-index.json
//   - docker-compose-style YAML is not regenerated (the compose files were
//     deleted by Phase A — the helm chart is now the only deploy path).
import fs from "node:fs"; import path from "node:path";
const ROOT = process.cwd();
const cat  = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/perplexity-connectors.json"), "utf8"));
const manPath = path.join(ROOT, "scripts/mcps.manifest.json");
const idxPath = path.join(ROOT, "infra/helm/pervagans/mcps-index.json");
const allPath = path.join(ROOT, "infra/helm/pervagans/mcps-all.txt");
const man = JSON.parse(fs.readFileSync(manPath, "utf8"));
const idx = JSON.parse(fs.readFileSync(idxPath, "utf8"));
const allTokens = fs.readFileSync(allPath, "utf8").split(/\s+/).filter(Boolean);
const existingIds = new Set(man.servers.map((s) => s.id));
// Next available port = highest currently used + 1
let nextPort = Math.max(...man.servers.map((s) => s.port).filter(Boolean)) + 1;

const TS_CONFIG = JSON.stringify({
  compilerOptions: {
    target: "ES2022", module: "Node16", moduleResolution: "Node16",
    lib: ["ES2022"], outDir: "dist", rootDir: "src",
    strict: true, esModuleInterop: true, skipLibCheck: true,
    resolveJsonModule: true, declaration: false,
  },
  include: ["src/**/*"],
}, null, 2) + "\n";

function pkgJSON(id) {
  return JSON.stringify({
    name: `@pervagans/mcp-${id}`,
    version: "0.1.0",
    private: true,
    type: "module",
    main: "dist/index.js",
    scripts: {
      build: "tsc -p tsconfig.json",
      start: "node dist/index.js",
      dev:   "tsx src/index.ts",
    },
    dependencies: {
      "@pervagans/mcp-base": "file:../../packages/mcp-base",
      zod:    "^3.23.8",
      undici: "^6.21.0",
    },
    devDependencies: {
      "@types/node": "^22.10.0",
      tsx:         "^4.19.2",
      typescript:  "^5.6.3",
    },
  }, null, 2) + "\n";
}

function dockerfile(id, port) {
  return `# Build stage — context is repo root
FROM node:20-bookworm-slim AS build
WORKDIR /build
COPY packages/mcp-base/package.json packages/mcp-base/tsconfig.json /build/packages/mcp-base/
COPY packages/mcp-base/src /build/packages/mcp-base/src
RUN cd /build/packages/mcp-base && npm install --no-audit --no-fund && npx tsc -p tsconfig.json
WORKDIR /build/mcps/${id}
COPY mcps/${id}/package.json mcps/${id}/tsconfig.json ./
COPY mcps/${id}/src ./src
RUN npm install --no-audit --no-fund && npx tsc -p tsconfig.json

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HTTP_ONLY=1
COPY --from=build /build/mcps/${id} /app
COPY --from=build /build/packages/mcp-base /app/node_modules/@pervagans/mcp-base
EXPOSE ${port}
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\
  CMD node -e "fetch('http://localhost:${port}/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
`;
}

function indexTS(id, name, category, port) {
  return `import { McpServer } from "@pervagans/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       ${JSON.stringify(id)},
  name:     ${JSON.stringify(name)},
  kind:     "api",
  category: ${JSON.stringify(category)},
  base:     "",
  port:     ${port},
  version:  "0.1.0",
});

registerTools(server);
server.run();
`;
}

function toolsTS(name, homepage) {
  // Stub tools — return a structured "needs configuration" response so the
  // LLM has a clear, untruncated, citation-shaped object to render. Once the
  // user wires the real OAuth/API key, the handler body can be replaced.
  const safeName = name.replace(/"/g, '\\"');
  return `import { z, McpServer } from "@pervagans/mcp-base";

// ${safeName} — connector observed in the Perplexity Computer Connectors
// catalogue. Stub implementation: returns a "not yet configured" object so
// callers (the chat layer, the connectors picker) see a stable response
// shape until the OAuth / API-key wiring lands. The user-facing copy points
// at the official homepage so the model can suggest the right place to
// authenticate.
const HOMEPAGE = ${JSON.stringify(homepage)};
const NOT_CONFIGURED = {
  status: "not-configured",
  message: "${safeName} connector is registered but not yet authenticated. Add credentials in Settings → Connectors.",
  homepage: HOMEPAGE,
};

export function registerTools(server: McpServer) {
  server.tool({
    name: "search",
    description: "Search ${safeName}. Returns 'not-configured' until OAuth/API credentials are supplied.",
    input: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(50).optional() }),
    handler: async ({ query, limit = 10 }) => ({
      source: ${JSON.stringify(name)},
      query,
      limit,
      count: 0,
      results: [],
      ...NOT_CONFIGURED,
    }),
  });

  server.tool({
    name: "fetch",
    description: "Fetch a record from ${safeName} by id or URL. Stub until configured.",
    input: z.object({ url: z.string().url() }).or(z.object({ id: z.string().min(1) })),
    handler: async (input) => ({
      source: ${JSON.stringify(name)},
      input,
      ...NOT_CONFIGURED,
    }),
  });
}
`;
}

let created = 0;
const added = [];
for (const c of cat.connectors) {
  if (existingIds.has(c.id)) continue;
  const port = nextPort++;
  const dir  = path.join(ROOT, "mcps", c.id);
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.writeFileSync(path.join(dir, "Dockerfile"),         dockerfile(c.id, port));
  fs.writeFileSync(path.join(dir, "package.json"),       pkgJSON(c.id));
  fs.writeFileSync(path.join(dir, "tsconfig.json"),      TS_CONFIG);
  fs.writeFileSync(path.join(dir, "src", "index.ts"),    indexTS(c.id, c.name, c.category, port));
  fs.writeFileSync(path.join(dir, "src", "tools.ts"),    toolsTS(c.name, c.homepage));
  // Append to in-memory registries
  man.servers.push({
    id:       c.id,
    name:     c.name,
    kind:     "api",
    category: c.category,
    feature:  c.feature,
    port,
    base:     "",
    homepage: c.homepage,
    tools:    ["search", "fetch"],
  });
  idx.byId[c.id] = { kind: "api", port, name: c.name, category: c.category, feature: c.feature, homepage: c.homepage };
  allTokens.push(c.id);
  added.push(c.id);
  created++;
}

fs.writeFileSync(manPath, JSON.stringify(man, null, 2) + "\n");
fs.writeFileSync(idxPath, JSON.stringify(idx, null, 2) + "\n");
fs.writeFileSync(allPath, allTokens.join(" ") + "\n");
console.log(`Created ${created} MCP stubs. Total MCPs now: ${man.servers.length}`);
console.log(`Next free port: ${nextPort}`);
