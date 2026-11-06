# VAE Manager — common tasks. Run `make` or `make help` to list them.

COMPOSE       := docker compose
COMPOSE_LOCAL := docker compose -f docker-compose.local.yml
DEV_PIN       ?= 123456
BACKUP_DIR    ?= backups
VOLUME        := vae-manager_vae-data

.DEFAULT_GOAL := help
.PHONY: help install dev dev-server dev-client build start \
        local local-down local-logs \
        prod-check prod up down restart rebuild logs ps shell update backup clean

help: ## List available commands
	@grep -hE '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[33m%-12s\033[0m %s\n", $$1, $$2}'

# ---------- Development ----------

install: ## Install server and client dependencies
	cd server && npm ci
	cd client && npm ci

dev: ## Run API (:3000) + Vite UI (:5173) with hot reload — Ctrl+C stops both
	@echo "UI: http://localhost:5173  ·  PIN: $(DEV_PIN)  ·  data: ./data"
	@$(MAKE) --no-print-directory -j2 dev-server dev-client

dev-server: ## Run only the API with auto-restart
	cd server && INITIAL_PIN=$(DEV_PIN) npm run dev

dev-client: ## Run only the Vite dev server
	cd client && npm run dev

build: ## Build the client for production (client/dist)
	cd client && npm run build

start: build ## Run the production build locally without Docker (:3000)
	cd server && DATA_DIR=../data PUBLIC_DIR=../client/dist INITIAL_PIN=$(DEV_PIN) NODE_ENV=production npm start

# ---------- Docker, local (no Traefik) ----------

local: ## Build and run the image locally on http://localhost:3000
	$(COMPOSE_LOCAL) up -d --build
	@echo "http://localhost:3000  ·  PIN: $${INITIAL_PIN:-123456}"

local-down: ## Stop the local container (data volume kept)
	$(COMPOSE_LOCAL) down

local-logs: ## Follow local container logs
	$(COMPOSE_LOCAL) logs -f

# ---------- Docker, production (behind Traefik) ----------

prod-check:
	@test -f .env || { echo "Missing .env — run: cp .env.example .env and edit it"; exit 1; }

prod: up ## Alias for `up`

up: prod-check ## Build and start production behind Traefik
	$(COMPOSE) up -d --build

down: prod-check ## Stop production (data volume kept)
	$(COMPOSE) down

restart: prod-check ## Restart the production container
	$(COMPOSE) restart

rebuild: prod-check ## Rebuild the image from scratch and restart
	$(COMPOSE) build --no-cache
	$(COMPOSE) up -d

update: prod-check ## git pull, then rebuild and restart
	git pull --ff-only
	$(COMPOSE) up -d --build

logs: prod-check ## Follow production logs
	$(COMPOSE) logs -f --tail=100

ps: ## Show container status
	$(COMPOSE) ps

shell: ## Open a shell in the production container
	$(COMPOSE) exec vae-manager sh

backup: ## Archive the production data volume to ./backups/
	@mkdir -p $(BACKUP_DIR)
	docker run --rm -v $(VOLUME):/data:ro -v "$(CURDIR)/$(BACKUP_DIR)":/out alpine \
		tar czf /out/vae-data-$$(date +%Y%m%d-%H%M%S).tgz -C /data .
	@ls -lh $(BACKUP_DIR) | tail -n 3

# ---------- Housekeeping ----------

clean: ## Remove node_modules and build output (keeps ./data)
	rm -rf server/node_modules client/node_modules client/dist
