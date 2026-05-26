FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# `npm ci` not `npm install`: ci installs exactly the lockfile and fails
# on drift, so the production image and the lockfile checked into git
# can never diverge silently. `--ignore-scripts` blocks postinstall
# hooks from third-party packages, the standard supply-chain mitigation.
RUN npm ci --no-audit --no-fund --ignore-scripts

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-bookworm-slim AS run
WORKDIR /app
# HOSTNAME=0.0.0.0 because Next.js standalone server.js honors the HOSTNAME
# env var, and Kubernetes sets HOSTNAME to the pod name — which DNS-resolves
# to the pod IP. Without this override Next.js binds only to that pod IP, so
# `kubectl port-forward` fails (kubelet talks to the container's localhost,
# not the pod IP) and standard service-IP routing also breaks.
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
