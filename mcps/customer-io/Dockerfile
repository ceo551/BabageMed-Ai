# Build stage — context is repo root
# NOTE: kept BuildKit-free (no `# syntax=` directive, no `--mount=type=cache`)
# so this Dockerfile builds on classic Docker engines too — e.g. ACR Tasks
# without explicit BuildKit opt-in.
FROM node:20-bookworm-slim AS build
WORKDIR /build
# Shared base — gets its own layer so it caches across all 262 MCPs
COPY packages/mcp-base/package.json packages/mcp-base/tsconfig.json /build/packages/mcp-base/
COPY packages/mcp-base/src /build/packages/mcp-base/src
RUN \
    cd /build/packages/mcp-base && npm install --no-audit --no-fund --ignore-scripts && npx tsc -p tsconfig.json
# This MCP — placed at /build/mcps/customer-io/ so file:../../packages/mcp-base resolves
WORKDIR /build/mcps/customer-io
COPY mcps/customer-io/package.json mcps/customer-io/tsconfig.json ./
COPY mcps/customer-io/src ./src
# Google OAuth helper now lives in @babagemed/mcp-base — copied above.
RUN \
    npm install --no-audit --no-fund --ignore-scripts && npx tsc -p tsconfig.json

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HTTP_ONLY=1
COPY --from=build /build/mcps/customer-io /app
COPY --from=build /build/packages/mcp-base /app/node_modules/@babagemed/mcp-base
EXPOSE 6611
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:6611/health').then(r=>{r.arrayBuffer().finally(()=>process.exit(r.ok?0:1))}).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
