# Build stage — context is repo root
FROM node:20-bookworm-slim AS build
WORKDIR /build
COPY packages/mcp-base/package.json packages/mcp-base/tsconfig.json /build/packages/mcp-base/
COPY packages/mcp-base/src /build/packages/mcp-base/src
RUN cd /build/packages/mcp-base && npm install --no-audit --no-fund && npx tsc -p tsconfig.json
WORKDIR /build/mcps/ticket-tailor
COPY mcps/ticket-tailor/package.json mcps/ticket-tailor/tsconfig.json ./
COPY mcps/ticket-tailor/src ./src
COPY mcps/_shared /build/mcps/_shared
RUN npm install --no-audit --no-fund && npx tsc -p tsconfig.json

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HTTP_ONLY=1
COPY --from=build /build/mcps/ticket-tailor /app
COPY --from=build /build/packages/mcp-base /app/node_modules/@babagemed/mcp-base
EXPOSE 6581
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:6581/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
