.PHONY: help env generate up up-minimal up-kvm2 up-kvm2-tls up-full down logs ps health rebuild clean

SHELL := /bin/bash
COMPOSE_FULL    := docker compose -f docker-compose.yml -f docker-compose.mcps.yml
COMPOSE_MINIMAL := docker compose -f docker-compose.yml -f docker-compose.minimal.yml
COMPOSE_KVM2    := docker compose -f docker-compose.yml -f docker-compose.kvm2.yml
COMPOSE_KVM2_TLS:= docker compose -f docker-compose.yml -f docker-compose.kvm2.yml -f docker-compose.caddy.yml

help:
	@echo "BabageMed AI — common tasks"
	@echo ""
	@echo "  make env            Copy .env.example → .env (only if .env missing)"
	@echo "  make generate       Regenerate all 86 MCP scaffolds from manifest"
	@echo ""
	@echo "  make up-minimal     Bring up frontend + backend + 12 API MCPs (recommended first run)"
	@echo "  make up-kvm2        Bring up curated 47-MCP stack for Hostinger KVM2 (2 vCPU / 8 GB / 100 GB)"
	@echo "  make up-kvm2-tls    Same as up-kvm2 + Caddy reverse-proxy with auto-TLS (set DOMAIN=…)"
	@echo "  make up-full        Bring up all 416 MCPs (heavy — needs ~250 GB disk, ~40 GB RAM)"
	@echo "  make down           Stop and remove containers"
	@echo "  make logs           Tail logs (Ctrl-C to exit)"
	@echo "  make ps             Show running containers"
	@echo "  make health         Hit backend /health and dump per-MCP status"
	@echo "  make rebuild        Rebuild images without cache (after manifest/code edits)"
	@echo "  make clean          Remove containers + images + volumes"

env:
	@if [ -f .env ]; then echo ".env already exists — leaving it alone."; else cp .env.example .env && echo "Created .env from .env.example. Edit it to add your keys."; fi

generate:
	node scripts/append-medical-mcps.mjs
	node scripts/generate-mcps.mjs
	node scripts/write-real-tools.mjs
	node scripts/generate-kvm2-compose.mjs

up: up-minimal

up-minimal:
	$(COMPOSE_MINIMAL) up -d --build
	@echo ""
	@echo "Dashboard:  http://localhost:3000"
	@echo "Backend:    http://localhost:8080/health"

up-kvm2:
	$(COMPOSE_KVM2) up -d --build
	@echo ""
	@echo "Dashboard:  http://localhost:3000"
	@echo "Backend:    http://localhost:8080/health"
	@echo "47 MCPs running (mix of API + scrape)"

up-kvm2-tls:
	@test -n "$$DOMAIN" || (echo "DOMAIN env var required (e.g. DOMAIN=app.babagemed.com make up-kvm2-tls)" && exit 1)
	$(COMPOSE_KVM2_TLS) up -d --build
	@echo ""
	@echo "Dashboard:  https://$$DOMAIN (cert issued in ~30 s on first start)"

up-full:
	$(COMPOSE_FULL) up -d --build
	@echo ""
	@echo "Dashboard:  http://localhost:3000"
	@echo "Backend:    http://localhost:8080/health"
	@echo "Each MCP:   http://localhost:6101 … :6530"

down:
	-$(COMPOSE_FULL) down
	-$(COMPOSE_MINIMAL) down
	-$(COMPOSE_KVM2) down
	-$(COMPOSE_KVM2_TLS) down

logs:
	$(COMPOSE_FULL) logs -f --tail=50

ps:
	docker compose -f docker-compose.yml ps
	@echo ""
	@docker ps --filter "name=babagemed" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

health:
	@curl -sS http://localhost:8080/health | python3 -m json.tool 2>/dev/null || curl -sS http://localhost:8080/health

rebuild:
	$(COMPOSE_FULL) build --no-cache

clean:
	-$(COMPOSE_FULL) down -v --rmi local
	-$(COMPOSE_MINIMAL) down -v --rmi local
