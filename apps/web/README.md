# Babbage AI — Web

The Next.js 14 (App Router) dashboard. This is the canonical client — the
iOS, Android, and Desktop apps load the deployed version of this app
inside a native shell.

## Develop

```bash
# From apps/web/
npm install
npm run dev          # http://localhost:3000
```

The dev server proxies `/api/backend/*` to the Go backend at
`http://localhost:8080` (see `next.config.mjs`).

## Build

```bash
npm run build        # produces .next/standalone/
```

## Deploy

```bash
# Image is built by infra/k8s/build-and-push.sh and rolled out via the
# Helm chart in infra/helm/babagemed (deployment name stays `frontend`
# for backwards compatibility).
docker build -t ghcr.io/<org>/frontend:latest -f Dockerfile .
```
