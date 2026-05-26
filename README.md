# Babbage AI

Customisable AI workflows — Next.js dashboard + Go backend + 540 Dockerized
TypeScript MCP servers + native shells for **iOS, Android, and Desktop
(Windows, macOS, Linux Ubuntu)**.

The product surfaces 8 fixed feature categories — Healthcare & life
sciences · Writing & content creation · Translation & languages · Business
· Financial · Consulting · Mathematics & Science · Education — each with
its own instructions, files, skills, and connector picks.

## Monorepo layout

```
.
├─ apps/
│   ├─ web/        Next.js 14 dashboard (the canonical client; everything
│   │              else loads this URL inside a native shell)
│   ├─ desktop/    Tauri 2.0 wrapper → .exe / .dmg / .AppImage / .deb
│   ├─ ios/        SwiftUI + WKWebView shell (iOS 16+)
│   └─ android/    Compose + WebView shell (Android 7.0+, API 24)
├─ backend/        Go 1.22 + chi — auth, chat orchestrator, MCP router
├─ mcps/           540 Dockerized TypeScript MCP servers
├─ packages/
│   └─ mcp-base/   Shared TypeScript lib (ApiClient, Scraper, McpServer)
├─ infra/
│   ├─ helm/       Helm chart that deploys the whole stack to any k8s
│   ├─ k8s/        Raw k8s manifests + build-and-push.sh
│   └─ gitops/     ArgoCD + Flux definitions
└─ scripts/        MCP generators, audit tools, manifests
```

### Why a monorepo with shared web frontend?

| | One web frontend reused | Four native UIs |
|---|---|---|
| Bug fixes | Ship once, all platforms get it | Fix four times |
| Connectors | One picker, 540 servers | Re-implement per platform |
| Auth | One session model | Sync four token caches |
| Deploy cadence | Push to web → everywhere updates | Re-submit to 3 app stores per release |

v1 of every platform is a WebView shell over `https://babagemed.com`.
Native screens (file pickers, dictation, share intents, system tray) layer
in incrementally where they pay off — but the chat, the 8 features, and
the 540 connectors are written **once**, in `apps/web/`.

## Quick start

### Run the backend + web locally

```bash
# 1. Backend (Go 1.23+ + Postgres 16)
cd backend && cp ../.env.example .env && go run .

# 2. Web frontend
cd apps/web && npm install && npm run dev   # http://localhost:3000
```

### Run the desktop app (uses the dev web)

```bash
cd apps/desktop && npm install && npm run dev
# Opens a native window pointed at http://localhost:3000
```

### Run the iOS app

Open `apps/ios/BabbageAI/BabbageAI.xcodeproj` in Xcode 15+, pick a
simulator, hit ▶. (Project file is regenerated from `project.yml` via
`xcodegen` — see `apps/ios/README.md`.)

### Run the Android app

```bash
cd apps/android && ./gradlew :app:installDebug
adb shell am start -n com.babbage.ai.debug/com.babbage.ai.MainActivity
```

Or open `apps/android/` in Android Studio Iguana+.

## The 540 MCPs

Each MCP is one Dockerized TypeScript service exposing:
- **stdio** — standard MCP JSON-RPC (any MCP-capable client connects directly)
- **HTTP** — `GET /health`, `GET /tools`, `POST /call/<tool>`, `POST /rpc`

317 are first-party (medical APIs, registries, journals, society sites,
FOAMed refs, productivity tools); 223 were added in Phase B as
Perplexity-style stubs (Stripe, Linear, Notion, HubSpot, Figma, etc.)
that need OAuth wiring before they return real data.

Source of truth: `scripts/mcps.manifest.json`. Catalog browser:
`/mcps` in the web app.

### Build + push every MCP image

```bash
REGISTRY=ghcr.io/your-org TAG=v0.1.0 ./infra/k8s/build-and-push.sh
```

Or via the per-shard GitHub Actions workflow in
`.github/workflows/build-images.yml` (splits the 540 images across 16
parallel runners, ~12 min total cold build).

## Deploy

The Helm chart in `infra/helm/babagemed/` deploys the whole stack to any
Kubernetes cluster. See the chart's `values.yaml` for the full surface
and `infra/helm/babagemed/values-aks-test.yaml` for a known-working AKS
overlay.

GitOps overlays in `infra/gitops/` keep ArgoCD or Flux in sync with the
chart. The CI workflow auto-bumps the image tag on every push to `main`.

## Repository hygiene

- **Issues / PRs:** target `main`. Per-app changes belong in their
  `apps/<name>/` folder; backend + MCPs stay in their respective trees.
- **Commit prefix conventions:** none enforced — write clear sentences.
- **Versions:** every native client tracks `apps/web/package.json`
  `version` field. Bump there, then sync into:
  - `apps/desktop/src-tauri/Cargo.toml` + `tauri.conf.json`
  - `apps/ios/BabbageAI/BabbageAI/Info.plist` (CFBundleShortVersionString)
  - `apps/android/app/build.gradle.kts` (versionName + versionCode)

## License

Proprietary — © 2026 Babbage AI. All rights reserved.
