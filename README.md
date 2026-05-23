# BabageMed AI

Clinical assistant — Next.js dashboard + Go backend + **416 Dockerized TypeScript MCP servers** covering medical APIs, registries, journals, guidelines, society websites, FOAMed/educational refs, and productivity tools.

## Architecture

```
┌──────────────────┐    ┌──────────────────┐    ┌───────────────────────────┐
│  Next.js (3000)  │───▶│  Go backend      │───▶│  86 MCP servers           │
│  /app dashboard  │    │  (8080) /api/*   │    │  HTTP :6101..:6186        │
│  EN / AR, RTL    │    │  LLM router      │    │  + stdio MCP protocol     │
└──────────────────┘    │  MCP orchestrator│    └───────────────────────────┘
                        └──────────────────┘
```

- **Frontend** (`frontend/`) — Next.js 14 (App Router, TypeScript). Pixel-matched to the Claude Design handoff (`Dashboard.html`). Bilingual EN/AR with full RTL, dark/light/system themes, model picker, mode toggle.
- **Backend** (`backend/`) — Go 1.22 + chi. Loads `scripts/mcps.manifest.json`, exposes `/api/mcp/*` to call any tool on any MCP, and `/api/chat` to orchestrate LLM calls (Anthropic / Google / OpenAI) with retrieval from selected MCPs.
- **MCP servers** (`mcps/<id>/`) — 86 standalone Dockerized TypeScript services. Each exposes:
  - **stdio** — standard MCP JSON-RPC protocol (so any MCP-capable client can connect directly).
  - **HTTP** — `GET /health`, `GET /tools`, `POST /call/<toolName>`, `POST /rpc`. Used by the Go backend.
- **Shared base** (`packages/mcp-base/`) — `ApiClient` (HTTP + retries + per-RPS throttle + TTL cache), `Scraper` (Playwright + cheerio + robots-respect + browser-fallback on 403/429/503), and `McpServer` (handles tool registration + both transports).

## The 416 MCPs

416 servers grouped by access strategy. The first 86 cover the original product surface (chat + productivity + core medical APIs); the additional 330 (ports 6201–6530) are scrape-driven access to society websites, OA journals, FOAMed blogs, national agencies, and international medical bodies — sourced from a curated list of ~316 verified medical/healthcare sites across ~35 specialties.

### First 86 (ports 6101–6186)

| Strategy | Count | Examples |
|---|---|---|
| **API (free / public)** | 24 | pubmed, ncbi, icd10, clinicaltrials, fda (openFDA), dailymed, medlineplus, pubchem, chembl, who (GHO OData), cdc (Socrata), npi (NPPES), nci (EVS), cms (data.cms.gov), medrxiv, biorxiv, nhs, endotext (NCBI Bookshelf), wikem (MediaWiki), eyewiki (MediaWiki), ourworldindata |
| **API (Crossref-backed for journals)** | 5 | nejm, bmj, cochrane, frontiers, rmopen |
| **API (auth-required)** | 12 | notion, slack, kaggle, linkedin, gmail, gcalendar, gdrive, github, huggingface, ms365, hostinger, godaddy |
| **Scrape (Playwright, robots-respecting)** | 45 | mayoclinic, clevelandclinic, rsna, radiopaedia, medscape, webmd, merckmanuals, drugscom, rxlist, healthline, cvphysiology, litfl, ninds, niddk, biocodex, nhlbi, kdigo, kidneyfoundation, renalfellow, healio, cancerorg, oncolink, rheumatology, arthritis, creakyjoints, lupus, spondylitis, derangedphys, thebottomline, nimh, rcpsych, psychiatrictimes, nami, rebelem, first10em, familydoctor, healthdata, pathologyoutlines, testingcom, dftb, coreem, iowaprotocols, fpnotebook, globalfamilydoctor, gamma |
| **Scrape (browser-driven, low-rate)** | 2 | googlescholar, chrome (general Playwright browser tool) |

### Additional 330 (ports 6201–6530, all scrape-driven)

Defined in `scripts/medical-sites.json` and appended to the master manifest via `node scripts/append-medical-mcps.mjs`. Grouped by specialty: cardiology (15), oncology (14), neurology (9), psychiatry (6), pediatrics (8), radiology (8), pharmacology / drug regulation (16), surgery / plastic surgery (12), anesthesia / critical care (10), public health / epidemiology (19), endocrinology (8), gastroenterology / hepatology (10), pulmonology (7), dermatology (6), ENT (4), ophthalmology (7), OB-GYN (6), urology (4), orthopedics / sports medicine (15), hematology (5), infectious disease / HIV (5), allergy (5), pathology (6), genetics / rare disease (6), geriatrics (4), palliative care (5), dentistry (8), nutrition (5), PM&R (4), emergency medicine (12), primary care / family medicine / internal medicine (8), nephrology (4), rheumatology (3), veterinary (7), OA journals (44), med-ed / reference (10), and other (3).

Source of truth: `scripts/mcps.manifest.json` (auto-merged from `scripts/medical-sites.json` for the medical scrape batch). Each row → one folder under `mcps/<id>/`.

### Per-site search URL templates

`scripts/site-search-patterns.json` maps each scrape MCP id to a real search-URL template (with `{q}` placeholder) and result-row CSS selectors — so `mcp-plosone search` actually hits PLOS's `/search?q=…` endpoint and pulls out `.search-result` rows, instead of guessing with the generic WordPress `/?s=…` fallback.

Shared platform presets (`_oup`, `_bmj`, `_bmc`, `_plos`, `_jmir`, `_mdpi`, `_jama`, `_lancet`, `_wiley`, `_nature`, `_aha`, `_silverchair`, `_springer`, `_socrata`, `_drupal`, `_wordpress`, `_mediawiki`) keep the file compact — most journals reference a preset via `$alias`. Per-id overrides take precedence.

Add a new site or refine an existing template: edit `scripts/site-search-patterns.json`, then `node scripts/generate-mcps.mjs && node scripts/write-real-tools.mjs` rewrites every scrape MCP that uses the fallback template. Hand-written MCPs (PubMed, FDA, ClinicalTrials, etc.) are unaffected — they have richer per-source logic in `scripts/write-real-tools.mjs`.

## Quick start

```bash
# 1. Configure
cp .env.example .env
# Fill in: NCBI_EMAIL, ANTHROPIC_API_KEY (or GOOGLE_API_KEY / OPENAI_API_KEY),
# and any third-party tokens you want (NOTION_TOKEN, SLACK_BOT_TOKEN, …).

# 2. Generate MCP scaffolds (already committed, re-run if you edit the manifest)
node scripts/append-medical-mcps.mjs   # merge medical-sites.json into the master manifest (idempotent)
node scripts/generate-mcps.mjs
node scripts/write-real-tools.mjs

# 3. Build mcp-base (frontend & backend Dockerfiles do this implicitly)
cd packages/mcp-base && npm install && npx tsc -p tsconfig.json && cd ../..

# 4. Bring everything up
docker compose -f docker-compose.yml -f docker-compose.mcps.yml up -d --build

# Dashboard:   http://localhost:3000
# Backend API: http://localhost:8080
# Each MCP:    http://localhost:6101 … :6186  (one port per server)
```

Want only a subset? `docker compose -f docker-compose.yml -f docker-compose.mcps.yml up -d mcp-pubmed mcp-fda backend frontend`.

## Backend API

```
GET  /health                              → backend + per-MCP up/down
GET  /api/mcp/servers                     → list all 416
GET  /api/mcp/servers/{id}                → metadata for one
GET  /api/mcp/servers/{id}/tools          → its tool schemas
POST /api/mcp/call/{id}/{tool}            → invoke; body is the tool input
POST /api/chat                            → orchestrated chat
POST /api/chat/stream                     → SSE: status/citations/content/done

POST /api/auth/signup                     → {email, password, displayName?} → user + cookie
POST /api/auth/login                      → {email, password} → user + cookie
POST /api/auth/logout                     → clears cookie + DB session
GET  /api/auth/me                         → current user (401 if no session)

GET  /api/payments/plans                  → catalog with EGP + USD pricing
GET  /api/payments/providers              → which providers are configured

POST /api/payments/paymob/checkout        → returns hosted iframe URL
POST /api/payments/paymob/webhook?hmac=…  → HMAC-SHA512-verified + persists transaction
POST /api/payments/paypal/checkout        → returns approve URL
POST /api/payments/paypal/capture         → capture after user approves
POST /api/payments/paypal/webhook         → signature-verified + persists transaction
```

## Auth & persistence (Postgres)

The backend now requires Postgres for auth + persistence. `docker-compose.yml` ships a `postgres:16-alpine` service with health-check, named volume `postgres_data`, and an `babagemed`/`babagemed` default user/db.

Migrations run automatically at backend startup from embedded SQL in `backend/internal/db/migrations/`. Currently:

| Table | Purpose |
|---|---|
| `users`          | id, email (unique), bcrypt password_hash, display_name, plan (`free`/`pro`/`max`), is_admin, timestamps |
| `sessions`       | id, user_id, token_hash (SHA-256 of opaque random token), user_agent, ip, expires_at |
| `payments`       | id, user_id, provider (`paymob`/`paypal`), external_id, plan_id, amount_minor, currency, status (`pending`/`paid`/`failed`/`refunded`), raw JSONB, unique (provider, external_id) |
| `chats`          | id, user_id, title, model, mode, timestamps |
| `chat_messages`  | id, chat_id, role (`user`/`assistant`/`system`), content, citations JSONB, meta JSONB |
| `schema_migrations` | tracks applied migration filenames |

Sessions are opaque random tokens (32 random bytes → base64url), stored as SHA-256 hashes in the DB. They're sent as `HttpOnly` cookies (`babagemed_session`) with `Secure` enabled automatically behind a TLS reverse-proxy. TTL: 30 days.

Payment webhooks are HMAC-/signature-verified, then persisted: `payments` rows are upserted by `(provider, external_id)` and marked `paid` when the provider confirms. When the original `/checkout` was made by an authenticated user, that user's plan auto-bumps to `pro` / `max` on confirmation.

If `DATABASE_URL` is unset, the backend still runs — auth and persistence are simply disabled, and the existing public endpoints (MCP, chat, payment initiation) work without persisting transactions.

## Frontend — MCP browser + tester

- `/mcps` — searchable, filter-by-kind, filter-by-category browse of all 416 MCP servers
- `/mcps/<id>` — server detail + tool list, with a **dynamic tool tester** that builds a form from each tool's `inputSchema` (handles strings, numbers, booleans, enums, arrays, objects) and calls `POST /api/mcp/call/<id>/<tool>` live, rendering the JSON response inline
- `/login` and `/signup` — auth pages wired to the cookie-based session
- Dashboard sidebar now shows the authenticated user's name + plan from `/api/auth/me`, plus a "Sign in / Sign up" pair when anonymous; the existing "Log out" row calls `/api/auth/logout` and clears local state

## Payments

Two providers wired up, no other dependencies:

- **Paymob (Egypt)** — Accept iframe flow. Set `PAYMOB_API_KEY`, `PAYMOB_INTEGRATION_ID`, `PAYMOB_IFRAME_ID`, `PAYMOB_HMAC` in `.env`. Frontend calls `/api/payments/paymob/checkout`, gets a hosted iframe URL, redirects the user. Webhook callback to `/api/payments/paymob/webhook?hmac=…` is HMAC-SHA512-verified against Paymob's documented field order.
- **PayPal (international)** — Orders v2 API. Set `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_ENV` (`sandbox` | `live`). Frontend calls `/api/payments/paypal/checkout`, gets an approval URL, redirects. After approval PayPal sends the user to `/billing/return?token=ORDER_ID`, which the frontend captures via `/api/payments/paypal/capture`. Webhooks are signature-verified via PayPal's `verify-webhook-signature` endpoint.

Plans live in `backend/internal/payments/plans.go` (Pro monthly · Max monthly · Max yearly, prices in both EGP piasters and USD cents). Visit `/billing` in the dashboard.

> **TODO before launch:** persist transactions and flip user entitlement in the webhook handlers (currently they verify + acknowledge but don't update any user record — wire to your auth/DB).

Example:

```bash
curl -s localhost:8080/api/mcp/call/pubmed/search -d '{"query":"CKD piperacillin","retmax":5}'
curl -s localhost:8080/api/mcp/call/clinicaltrials/search -d '{"query":"sepsis","status":"RECRUITING"}'
curl -s localhost:8080/api/chat -d '{
  "model":"opus-4.7","mode":"cited","locale":"en",
  "messages":[{"role":"user","content":"Pip-Tazo dose when eGFR 24?"}],
  "useMcps":["pubmed","fda","dailymed"]
}'
```

## MCP protocol — talking to a server directly

Every MCP speaks the standard Model Context Protocol on stdin (with `STDIO_ONLY=1`) **and** an HTTP wrapper:

```bash
# Both work — use HTTP for the dashboard, stdio for an MCP client (Claude Desktop, etc.).
curl localhost:6101/tools
curl -X POST localhost:6101/call/search -d '{"query":"hypertension","retmax":3}'
curl -X POST localhost:6101/rpc -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Wire any MCP into Claude Desktop / a code-host's MCP config:

```json
{
  "command": "docker",
  "args": ["run","-i","--rm","-e","STDIO_ONLY=1","--env-file","./.env","babagemed/mcp-pubmed:latest"]
}
```

## Scraping policy

The shared `Scraper` (`packages/mcp-base/src/scraper.ts`):

1. Tries an undici HEAD/GET first (fast, no browser).
2. On HTTP 403 / 429 / 503 it automatically escalates to a real Chromium browser via Playwright with light fingerprint scrubbing (no `navigator.webdriver`, real UA, plausible plugins).
3. Respects `robots.txt` by default — disable per-server with `respectRobots: false` only where you've confirmed it's appropriate (this is set for `chrome` and `googlescholar`).
4. Throttles to 1 req/sec by default (`SCRAPER_RATE_RPS`).
5. Caches HTML 24 h by default (`SCRAPER_CACHE_TTL_SEC`).
6. Will route through `SCRAPER_PROXY_URL` if set (use only with sources you have authorization for).

**This system does NOT include CAPTCHA solving, residential-proxy rotation, or active anti-bot evasion.** Those would expose a clinical product to legal risk and tend to break sources permanently. If a source's WAF blocks the browser path, the MCP returns a clear error rather than silently producing fake data.

## Repository layout

```
.
├── frontend/                  Next.js 14 dashboard (EN/AR, dark/light, RTL)
├── backend/                   Go 1.22 + chi orchestrator
│   ├── main.go
│   └── internal/{api,llm,mcp}
├── packages/
│   └── mcp-base/              Shared TS runtime (ApiClient + Scraper + McpServer)
├── mcps/                      86 server packages, each with src/ + Dockerfile
│   ├── pubmed/                Real implementations for 73 of the 86
│   ├── …
│   └── _shared/               Shared helpers
├── scripts/
│   ├── mcps.manifest.json     Single source of truth for all 86 servers
│   ├── generate-mcps.mjs      Materialise scaffolds from the manifest
│   └── write-real-tools.mjs   Override fallbacks with hand-written implementations
├── docker-compose.yml         Frontend + backend + shared network
├── docker-compose.mcps.yml    All 86 MCP services (auto-generated)
└── .env.example
```

## Adding a 87th MCP

1. Add an entry to `scripts/mcps.manifest.json`.
2. `node scripts/generate-mcps.mjs` — creates the directory.
3. Edit `mcps/<id>/src/tools.ts` with real tools (or just leave the fallback).
4. `docker compose -f docker-compose.yml -f docker-compose.mcps.yml up -d --build mcp-<id>`.

## Notes on the design handoff

The dashboard is a faithful port of `babagemed-ai/project/Dashboard.html` from your handoff bundle:

- Identical token system (`tokens.css`): `--cyan`, `--purple`, `--yellow`, `--ink`, light/dark, grid backdrop, gradient ambient.
- Identical sidebar (brand mark, customize / spaces / history rows, account popover with appearance + language sub-menus).
- Identical greeting + composer (model picker pill, voice / mic buttons, add-connector popover).
- Full RTL when locale = `ar`, including chevron mirroring.
- Wired to `POST /api/backend/api/chat` (Cmd/Ctrl+Enter or the send button).
