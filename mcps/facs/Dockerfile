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
    cd /build/packages/mcp-base && npm install --no-audit --no-fund && npx tsc -p tsconfig.json
# This MCP — placed at /build/mcps/facs/ so file:../../packages/mcp-base resolves
WORKDIR /build/mcps/facs
COPY mcps/facs/package.json mcps/facs/tsconfig.json ./
COPY mcps/facs/src ./src
# Shared helpers (e.g. Google OAuth) — pulled in by gmail/gcal/gdrive
COPY mcps/_shared /build/mcps/_shared
RUN \
    npm install --no-audit --no-fund && npx tsc -p tsconfig.json

FROM mcr.microsoft.com/playwright:v1.49.0-jammy
WORKDIR /app
ENV NODE_ENV=production HTTP_ONLY=1
COPY --from=build /build/mcps/facs /app
COPY --from=build /build/packages/mcp-base /app/node_modules/@babagemed/mcp-base
EXPOSE 6281
# Drop privileges — the Playwright base image ships with a pwuser
# (uid 1000) for exactly this purpose. Without it the renderer + the
# Node parent both run as root inside the container, which combined
# with any code-injection path would give attackers a root shell.
USER pwuser
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:6281/health').then(r=>{r.arrayBuffer().finally(()=>process.exit(r.ok?0:1))}).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
