# Build stage — context is repo root
FROM node:20-bookworm-slim AS build
WORKDIR /build
# Copy shared base package first so its layer caches
COPY packages/mcp-base/package.json packages/mcp-base/tsconfig.json /build/packages/mcp-base/
COPY packages/mcp-base/src /build/packages/mcp-base/src
RUN cd /build/packages/mcp-base && npm install --no-audit --no-fund && npx tsc -p tsconfig.json
# Copy this MCP's source
WORKDIR /build/mcp
COPY mcps/linkedin/package.json mcps/linkedin/tsconfig.json ./
COPY mcps/linkedin/src ./src
# Optional shared helpers (Google OAuth) used by gmail/gcal/gdrive
COPY mcps/_shared /build/mcps/_shared
RUN npm install --no-audit --no-fund && npx tsc -p tsconfig.json

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HTTP_ONLY=1
COPY --from=build /build/mcp /app
COPY --from=build /build/packages/mcp-base /app/node_modules/@babagemed/mcp-base
COPY --from=build /build/mcps/_shared /app/_shared
EXPOSE 6176
USER node
CMD ["node", "dist/index.js"]
