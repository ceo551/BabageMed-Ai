# Running BabageMed AI locally with Docker

## Requirements
- **Docker Desktop** (with Compose v2 — already bundled). On Linux: `docker` ≥ 20.10 and `docker compose` plugin.
- ~10 GB free disk for **minimal stack** (frontend + backend + 12 API MCPs).
- ~80 GB free disk and ~8 GB RAM for **full stack** (all 86 MCPs, includes Playwright/Chromium images).
- macOS / Linux / Windows-with-WSL2.

## TL;DR

```bash
cd BabageMed-Ai
cp .env.example .env
# (optional but recommended) edit .env and add ANTHROPIC_API_KEY for chat
make up-minimal
# open http://localhost:3000
```

Or skip `make` and run the docker commands directly — both are documented below.

---

## Step 1 — Configure environment

```bash
cd BabageMed-Ai
cp .env.example .env
```

Minimum keys you usually want:

| Variable | Why |
|---|---|
| `ANTHROPIC_API_KEY` | Required for `/api/chat` to actually talk. Pick **one** of Anthropic / Google / OpenAI keys. |
| `NCBI_EMAIL`        | Polite identification to NCBI E-utilities (PubMed). Defaults to `ceo@babagemed.com`. |
| `NCBI_API_KEY`      | Optional; raises PubMed rate limit from 3 → 10 req/s. |
| `OPENFDA_API_KEY`   | Optional; raises openFDA rate limit. |
| `PAYMOB_*` / `PAYPAL_*` | Only needed if you want to test the `/billing` flow end-to-end. |

The other 80+ MCPs need no keys (public APIs / scraping). MCPs whose keys you didn't fill in still run — they just return a clear error if a tool is called.

## Step 2 — Bring it up

### Recommended first run — minimal stack (frontend + backend + 12 API MCPs)

```bash
docker compose -f docker-compose.yml -f docker-compose.minimal.yml up -d --build
```

What this brings up:
- `babagemed-frontend` (Next.js) → http://localhost:3000
- `babagemed-backend` (Go) → http://localhost:8080
- 12 API-driven MCPs: pubmed, icd10, clinicaltrials, fda, dailymed, medlineplus, pubchem, chembl, who, cdc, npi, nci.

Build takes ~3–5 min on a decent machine the first time, ~30 s after that.

### Full stack — all 86 MCPs

```bash
docker compose -f docker-compose.yml -f docker-compose.mcps.yml up -d --build
```

What this adds: 45 Playwright/Chromium-backed scraping MCPs (mayoclinic, medscape, webmd, …), 24 auth-required MCPs (gmail, slack, notion, …), and 5 Crossref-backed journal MCPs.

First build is **slow** — most of the time is pulling `mcr.microsoft.com/playwright:v1.49.0-jammy` (~1.5 GB) and one `npm install` per MCP. The shared `mcp-base` layer is cached so subsequent builds are fast. Plan for 30–60 min on the first build.

## Step 3 — Verify

```bash
# Backend health + per-MCP up/down
curl -s http://localhost:8080/health | python3 -m json.tool

# List of all 86 MCPs the backend knows about
curl -s http://localhost:8080/api/mcp/servers | python3 -m json.tool | head -40

# Call a tool directly (PubMed search)
curl -s -X POST http://localhost:8080/api/mcp/call/pubmed/search \
  -H "content-type: application/json" \
  -d '{"query":"piperacillin tazobactam CKD","retmax":3}' | python3 -m json.tool

# Or hit an MCP server directly (bypasses the backend)
curl -s http://localhost:6101/health
curl -s -X POST http://localhost:6101/call/search -d '{"query":"hypertension"}'
```

Open the dashboard: **http://localhost:3000**

- Composer: type a clinical question, press the send button (or Cmd/Ctrl+Enter).
- Toggle EN / AR + theme via the account popover (bottom-left).
- Plans & billing → http://localhost:3000/billing.

## Step 4 — Day-to-day commands

```bash
# Tail logs (all services)
docker compose -f docker-compose.yml -f docker-compose.mcps.yml logs -f --tail=50

# Just a few services
docker compose -f docker-compose.yml -f docker-compose.minimal.yml logs -f backend mcp-pubmed

# Restart one MCP after editing its tools.ts
(cd mcps/pubmed && npm install && npx tsc -p tsconfig.json)
docker compose -f docker-compose.yml -f docker-compose.mcps.yml up -d --build mcp-pubmed

# Stop everything
docker compose -f docker-compose.yml -f docker-compose.mcps.yml down
# OR
make down
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `port is already allocated` | Something else owns 3000 / 8080 / 6101 etc. Find it with `lsof -i :8080` and free the port, or edit the compose file's `ports:` mapping. |
| Backend `/health` shows MCPs as `"down"` | They're still starting (Playwright images load slowly). Wait 30 s and retry; check `docker logs babagemed-backend` and `docker logs mcp-<id>`. |
| `Host not in allowlist` on an MCP tool call | Network policy blocks outbound. Not an MCP bug — happens in sandboxed environments. Run from your own laptop / VPS. |
| `mcp-<id>` keeps restarting | `docker logs mcp-<id>` will show the error. Most common: missing env var. Edit `.env`, then `docker compose … up -d --force-recreate mcp-<id>`. |
| `npm install` fails during MCP build | First make sure `packages/mcp-base/` is committed/exists. If you edited `mcps.manifest.json`, re-run `node scripts/generate-mcps.mjs && node scripts/write-real-tools.mjs` before rebuilding. |
| Out of disk | `docker system prune -af --volumes` reclaims space (will delete unused images too). Use the **minimal** stack until you really need a specific scrape MCP. |

## Notes on what each MCP does

- **API-driven (24)**: hit public REST endpoints (NCBI E-utils, openFDA, ClinicalTrials.gov, etc.). Fast, reliable, no anti-bot risk.
- **Scrape-driven (45)**: render the page in headless Chromium (Playwright). Respects `robots.txt`, throttled to 1 req/s, caches 24 h. Some sources will eventually block — when they do, the tool returns a clear error rather than fake data.
- **Auth-required (12)**: need a token in `.env` (gmail, slack, notion, gdrive, ms365, …). Without keys they still start but tool calls return `… not configured`.
- **Journal Crossref (5)**: nejm/bmj/cochrane/frontiers/rmopen route metadata queries through Crossref so you don't have to scrape paywalled pages for citations.

For the full list see `scripts/mcps.manifest.json`.

## Production deployment

These compose files are good for laptops and single-VPS testing. For production:
1. Move secrets out of `.env` into a real secret manager (Docker secrets, Hashicorp Vault, AWS SSM, etc.).
2. Put a reverse proxy (Caddy / Traefik / nginx) in front of `frontend:3000` and terminate TLS there.
3. Restrict `backend:8080` to internal network only (the frontend hits it via `BACKEND_URL`).
4. Persist webhook idempotency / billing state in Postgres (currently the payment handlers verify + ack but don't persist — wire that to your DB in `backend/internal/payments/handler.go`).
5. Either run only the MCPs you actually use, or scale horizontally — each MCP is independent.
