# Build stage — context is repo root
# NOTE: kept BuildKit-free (no `# syntax=` directive, no `--mount=type=cache`)
# so this Dockerfile builds on classic Docker engines too — e.g. ACR Tasks
# without explicit BuildKit opt-in.
FROM node:20-bookworm-slim AS build
WORKDIR /build
# Shared base — gets its own layer so it caches across all 539 MCPs
COPY packages/mcp-base/package.json packages/mcp-base/tsconfig.json /build/packages/mcp-base/
COPY packages/mcp-base/src /build/packages/mcp-base/src
RUN \
    cd /build/packages/mcp-base && npm install --no-audit --no-fund --ignore-scripts && npx tsc -p tsconfig.json
# This MCP — placed at /build/mcps/midpage/ so file:../../packages/mcp-base resolves
WORKDIR /build/mcps/midpage
COPY mcps/midpage/package.json mcps/midpage/tsconfig.json ./
COPY mcps/midpage/src ./src
# Shared helpers (e.g. Google OAuth) — pulled in by gmail/gcal/gdrive
COPY mcps/_shared /build/mcps/_shared
RUN \
    npm install --no-audit --no-fund --ignore-scripts && npx tsc -p tsconfig.json

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HTTP_ONLY=1
COPY --from=build /build/mcps/midpage /app
COPY --from=build /build/packages/mcp-base /app/node_modules/@babagemed/mcp-base
EXPOSE 6736
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:6736/health').then(r=>{r.arrayBuffer().finally(()=>process.exit(r.ok?0:1))}).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
