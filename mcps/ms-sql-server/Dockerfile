# Build stage — context is repo root
FROM node:20-bookworm-slim AS build
WORKDIR /build
COPY packages/mcp-base/package.json packages/mcp-base/tsconfig.json /build/packages/mcp-base/
COPY packages/mcp-base/src /build/packages/mcp-base/src
RUN cd /build/packages/mcp-base && npm install --no-audit --no-fund && npx tsc -p tsconfig.json
WORKDIR /build/mcps/ms-sql-server
COPY mcps/ms-sql-server/package.json mcps/ms-sql-server/tsconfig.json ./
COPY mcps/ms-sql-server/src ./src
COPY mcps/_shared /build/mcps/_shared
RUN npm install --no-audit --no-fund && npx tsc -p tsconfig.json

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HTTP_ONLY=1
COPY --from=build /build/mcps/ms-sql-server /app
COPY --from=build /build/packages/mcp-base /app/node_modules/@babagemed/mcp-base
EXPOSE 6708
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:6708/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
