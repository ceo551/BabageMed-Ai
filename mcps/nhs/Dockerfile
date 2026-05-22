# syntax=docker/dockerfile:1.6
# Build stage — context is repo root
FROM node:20-bookworm-slim AS build
WORKDIR /build
# Shared base — gets its own layer so it caches across all 86 MCPs
COPY packages/mcp-base/package.json packages/mcp-base/tsconfig.json /build/packages/mcp-base/
COPY packages/mcp-base/src /build/packages/mcp-base/src
RUN --mount=type=cache,target=/root/.npm \
    cd /build/packages/mcp-base && npm install --no-audit --no-fund && npx tsc -p tsconfig.json
# This MCP — placed at /build/mcps/nhs/ so file:../../packages/mcp-base resolves
WORKDIR /build/mcps/nhs
COPY mcps/nhs/package.json mcps/nhs/tsconfig.json ./
COPY mcps/nhs/src ./src
# Shared helpers (e.g. Google OAuth) — pulled in by gmail/gcal/gdrive
COPY mcps/_shared /build/mcps/_shared
RUN --mount=type=cache,target=/root/.npm \
    npm install --no-audit --no-fund && npx tsc -p tsconfig.json

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HTTP_ONLY=1
COPY --from=build /build/mcps/nhs /app
COPY --from=build /build/packages/mcp-base /app/node_modules/@babagemed/mcp-base
EXPOSE 6124
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:6124/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
