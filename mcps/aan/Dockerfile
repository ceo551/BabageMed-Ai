# Build stage — context is repo root
FROM node:20-bookworm-slim AS build
WORKDIR /build
# Shared base — gets its own layer so it caches across all 416 MCPs
COPY packages/mcp-base/package.json packages/mcp-base/tsconfig.json /build/packages/mcp-base/
COPY packages/mcp-base/src /build/packages/mcp-base/src
RUN \
    cd /build/packages/mcp-base && npm install --no-audit --no-fund && npx tsc -p tsconfig.json
# This MCP — placed at /build/mcps/aan/ so file:../../packages/mcp-base resolves
WORKDIR /build/mcps/aan
COPY mcps/aan/package.json mcps/aan/tsconfig.json ./
COPY mcps/aan/src ./src
# Shared helpers (e.g. Google OAuth) — pulled in by gmail/gcal/gdrive
COPY mcps/_shared /build/mcps/_shared
RUN \
    npm install --no-audit --no-fund && npx tsc -p tsconfig.json

FROM mcr.microsoft.com/playwright:v1.49.0-jammy
WORKDIR /app
ENV NODE_ENV=production HTTP_ONLY=1
COPY --from=build /build/mcps/aan /app
COPY --from=build /build/packages/mcp-base /app/node_modules/@babagemed/mcp-base
EXPOSE 6236
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:6236/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
