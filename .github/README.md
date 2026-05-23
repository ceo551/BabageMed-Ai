# GitHub Actions workflows

Three workflows. Each runs only what it needs.

## `ci.yml` — Lint + typecheck + chart validation

Runs on every PR and push to `main` / `develop` / `claude/**`. Jobs:

- **`backend`** — `go build`, `go vet`, `gofmt -l`, `go test -short`
- **`frontend`** — installs workspace + builds `mcp-base` + `tsc --noEmit` on the Next app
- **`mcp-base`** — `tsc --noEmit` on the shared package
- **`mcps-typecheck`** — 8-shard parallel `tsc --noEmit` over all 416 MCP packages. Shards are round-robin so each one mixes light + heavy packages.
- **`helm`** — `helm lint` + `helm template` smoke render with feature flags on, then a Python YAML parse to catch any structural breakage early.
- **`generators`** — re-runs `append-medical-mcps.mjs`, `generate-mcps.mjs`, `write-real-tools.mjs`, `generate-helm-index.mjs` and fails if the working tree is dirty. Keeps `mcps.manifest.json`, `mcps-index.json`, and the per-MCP scaffolds honest.

## `build-images.yml` — Build + push + GitOps bump

Runs on every push to `main`, on `v*` tags, and on manual dispatch. Pipeline:

1. **`meta`** — derives the image tag (`v…` for tags, `sha-<short>` otherwise) and produces a 16-shard JSON matrix of MCP ids.
2. **`build-core`** — backend + frontend images, parallel, with BuildKit gha cache.
3. **`build-mcps`** — 16-shard MCP image build, also with per-image gha cache. Each shard builds ~26 images sequentially inside a runner.
4. **`gitops-bump`** — writes the new tag to `infra/helm/babagemed/values-images.yaml`, commits + pushes back to `main`. ArgoCD / Flux pick up the file on their next reconcile and roll the deployment. If `vars.ARGOCD_WEBHOOK_URL` is set, the job also pings it for instant sync.

Override the registry with the `REGISTRY` repository variable (defaults to `ghcr.io/<owner>`). For private registries, the GitOps overlay still works — the chart honours `image.pullSecrets`.

## `e2e-mcps.yml` — End-to-end test per MCP

Runs on PRs touching the MCP layer, on manual dispatch, and nightly at 03:23 UTC. The schedule catches sites that quietly changed their HTML.

For each MCP the workflow:

1. `docker build` the image with the local mcp-base prebuilt
2. `docker run -p ... -e HTTP_ONLY=1`
3. Wait for `/health`
4. Hit `/tools` and validate every tool's schema
5. Hit `/metrics` and confirm it's Prometheus text format with `mcp_id="<id>"`
6. Hit `POST /call/search` with a known query (`hypertension`)

Exit codes from `scripts/mcp-e2e.mjs`:

- `0` — passed
- `2` — skipped (MCP needs credentials, or outbound network is blocked on this runner — counted in the summary, doesn't fail the build)
- `1` — failed

A summary table is posted to the run's GitHub step summary.

## Variables / secrets the workflows look for

| Name | Where | Purpose |
|---|---|---|
| `REGISTRY` (var) | repo or org | overrides `ghcr.io/<owner>` for image pushes |
| `GITOPS_TOKEN` (secret) | optional | fine-grained PAT for the bump-back commit if you've locked down `GITHUB_TOKEN` |
| `ARGOCD_WEBHOOK_URL` (var) | optional | ArgoCD webhook to force-sync on push |
| `ARGOCD_WEBHOOK_TOKEN` (secret) | optional | matching bearer token |
