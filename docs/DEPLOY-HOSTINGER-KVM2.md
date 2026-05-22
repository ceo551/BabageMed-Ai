# Deploying BabageMed AI on Hostinger KVM2

This guide is tuned for the **Hostinger KVM2** plan (2 vCPU · 8 GB RAM · 100 GB disk).
Equivalent specs on any other VPS (DigitalOcean, Hetzner, Linode, OVH, AWS Lightsail) work the same way.

## What fits on KVM2

|                   | Disk   | RAM peak | Verdict |
|-------------------|--------|----------|---------|
| Minimal (12 MCPs) | ~10 GB | ~3 GB    | ✅ comfortable |
| **KVM2 curated (47 MCPs)** | **~30 GB** | **~6 GB** | **✅ recommended** |
| Full (416 MCPs)   | ~250 GB | ~40 GB   | ❌ does not fit |

The "KVM2 curated" stack (`docker-compose.kvm2.yml`) brings up frontend + backend + **47 hand-picked MCPs**:

- **21 free-API MCPs**: pubmed, ncbi, icd10, clinicaltrials, fda, dailymed, medlineplus, pubchem, chembl, who, cdc, npi, nci, cms, medrxiv, biorxiv, nhs, endotext, wikem, ourworldindata, eyewiki
- **5 Crossref-backed journals**: cochrane, nejm, bmj, frontiers, rmopen
- **21 high-yield scrape MCPs (Playwright)**: mayoclinic, clevelandclinic, medscape, webmd, drugscom, rxlist, healthline, nice, cks, bnf, dermnet, orthoinfo, orthobullets, statpearls, emcrit, geekymedics, teachmeanatomy, openanesthesia, gold, gina, librepathology

Per-container memory limits in `docker-compose.kvm2.yml` cap API MCPs at 192 MB and Playwright MCPs at 384 MB — the OOM killer will only trigger on genuinely runaway containers.

If KVM2 ever feels tight, upgrade to KVM4 (4 vCPU / 16 GB / 200 GB) and switch to `up-full` — full 416 still won't fit, but you can run ~120-150 MCPs comfortably.

---

## Step 1 — Provision and harden the VPS (one-time)

SSH in as root (Hostinger sends the IP and password by email).

```bash
ssh root@<your-vps-ip>

# Create an unprivileged user (don't run Docker as root long-term)
adduser babagemed
usermod -aG sudo babagemed
mkdir -p /home/babagemed/.ssh
cp ~/.ssh/authorized_keys /home/babagemed/.ssh/   # if you used key auth
chown -R babagemed:babagemed /home/babagemed/.ssh
chmod 700 /home/babagemed/.ssh
chmod 600 /home/babagemed/.ssh/authorized_keys

# Disable password SSH (only do this after you've confirmed key auth works)
sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl reload ssh

# Updates + essentials
apt update && apt upgrade -y
apt install -y curl git ufw fail2ban unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades   # accept defaults

# Docker — official repo (the apt one is usually stale)
curl -fsSL https://get.docker.com | sh
usermod -aG docker babagemed

# Swap — protects against OOM when Chromium spikes
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl -w vm.swappiness=10

# Firewall — only 22/80/443 open to the world
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
systemctl enable --now fail2ban
```

Re-login as the new user from here: `ssh babagemed@<your-vps-ip>`.

## Step 2 — Clone the repo and configure

```bash
cd ~
git clone https://github.com/ceo551/BabageMed-Ai.git
cd BabageMed-Ai
git checkout claude/kind-ritchie-c2hXW   # current dev branch

cp .env.example .env
nano .env
```

Keys to fill in `.env`:

```
ANTHROPIC_API_KEY=sk-ant-…           # required for /api/chat
NCBI_EMAIL=you@yourdomain.com        # polite identification to PubMed
NCBI_API_KEY=…                       # optional, raises PubMed rate limit
OPENFDA_API_KEY=…                    # optional, raises openFDA rate limit

# If you'll take payments:
PAYMOB_API_KEY=…
PAYMOB_INTEGRATION_ID=…
PAYMOB_IFRAME_ID=…
PAYMOB_HMAC=…
PAYPAL_ENV=live
PAYPAL_CLIENT_ID=…
PAYPAL_CLIENT_SECRET=…
PAYPAL_WEBHOOK_ID=…
```

## Step 3 — Bring up the curated KVM2 stack

```bash
# Either:
docker compose -f docker-compose.yml -f docker-compose.kvm2.yml up -d --build

# Or the Makefile shortcut:
make up-kvm2
```

First build: **~15-25 min** (mostly downloading the Playwright image and one
`npm install` per MCP). Cached, subsequent builds finish in seconds.

While it builds, monitor with `htop` or `docker stats` from another SSH session.

## Step 4 — Add HTTPS with your domain

Point your domain (or a subdomain like `app.yourdomain.com`) to the VPS's IP — Hostinger's hPanel → DNS Zone → add an `A` record. Wait 1-5 min for propagation, verify with `dig`.

Then:

```bash
DOMAIN=app.yourdomain.com make up-kvm2-tls
```

Caddy starts on ports 80 and 443, proxies traffic to the frontend + backend containers, and auto-provisions a Let's Encrypt cert on first start (~30 s). After that:

- **Dashboard**: `https://app.yourdomain.com`
- **Billing**: `https://app.yourdomain.com/billing`
- **Backend API**: `https://app.yourdomain.com/api/backend/health`

## Step 5 — Day-to-day commands

```bash
# Tail logs (everything)
docker compose -f docker-compose.yml -f docker-compose.kvm2.yml logs -f --tail=50

# Just one MCP
docker compose -f docker-compose.yml -f docker-compose.kvm2.yml logs -f mcp-pubmed

# Restart after editing a tools.ts
(cd mcps/pubmed && npm install && npx tsc -p tsconfig.json)
docker compose -f docker-compose.yml -f docker-compose.kvm2.yml up -d --build mcp-pubmed

# Add another MCP from the catalogue without rebuilding everything
docker compose -f docker-compose.yml -f docker-compose.kvm2.yml up -d --build mcp-aaos

# Stop everything
make down

# Health check
make health
```

## Step 6 — Adding MCPs from the broader catalogue

Pick from `scripts/medical-sites.json` and add to `docker-compose.kvm2.yml` (or edit the `API_IDS` / `HYBRID_IDS` / `SCRAPE_IDS` lists in `scripts/generate-kvm2-compose.mjs` and re-run it). The Scraper containers all share the same ~1.5 GB Playwright image, so each extra one only adds ~50-100 MB to the running RAM footprint.

Rule of thumb on KVM2: don't exceed ~80 simultaneously-running scrape MCPs.

## Sizing / upgrade path

| Plan | vCPU / RAM / Disk | Max comfortable MCPs |
|------|---|---|
| KVM1 (small) | 1 / 4 / 50 | Minimal stack only (12 MCPs) |
| **KVM2**     | 2 / 8 / 100 | **~50** (this guide) |
| KVM4         | 4 / 16 / 200 | ~150 |
| KVM8         | 8 / 32 / 400 | ~300 |
| Dedicated/cloud (≥16 GB RAM, ≥500 GB) | — | Full 416 |

## Backups

Hostinger snapshots are paid extras — turn them on in hPanel. Manual backup of just the application state is cheap:

```bash
# From your laptop
ssh babagemed@vps "cd BabageMed-Ai && tar czf - .env scripts/mcps.manifest.json scripts/medical-sites.json" > babagemed-backup-$(date +%F).tar.gz
```

Everything else (code, MCP scaffolds, Docker images) is reproducible from `git pull && make up-kvm2`.

## Common issues

| Symptom | Fix |
|---|---|
| `docker: cannot connect to the Docker daemon` after re-login | `usermod -aG docker babagemed` then log out and back in. |
| Frontend builds, then container OOM-kills | Reduce concurrent build jobs: `docker compose build --parallel 2 …` |
| Caddy "ACME challenge failed" | DNS hasn't propagated yet, or ports 80/443 blocked. `dig app.yourdomain.com` and `ufw status`. |
| One MCP keeps restart-looping | `docker logs mcp-<id>`. Usually a missing env var. Edit `.env` and `up -d --force-recreate mcp-<id>`. |
| RAM > 7 GB | Some scrape MCP is leaking. `docker stats` to identify, `docker restart mcp-<id>` as a quick patch. Long-term: lower its memory limit in `docker-compose.kvm2.yml`. |
| `npm install` fails inside MCP container | Out of disk on `/var/lib/docker`. `docker system prune -af` reclaims space. |
