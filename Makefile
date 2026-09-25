FINANCIAL_APP_HTTP_PORT ?= 3081
FINANCIAL_APP_UID := $(shell id -u)
FINANCIAL_APP_GID := $(shell id -g)
CONTAINER_ENV := FINANCIAL_APP_HTTP_PORT=$(FINANCIAL_APP_HTTP_PORT) FINANCIAL_APP_UID=$(FINANCIAL_APP_UID) FINANCIAL_APP_GID=$(FINANCIAL_APP_GID)
DEPLOY_HOST ?= remote
DEPLOY_DIR ?= /var/www/financial-app

.PHONY: check container-build container-import-db container-up container-status container-logs container-check container-down deploy

check:
	npm run typecheck
	npm test
	npm run build

container-build:
	$(CONTAINER_ENV) docker compose build

container-import-db:
	@test -f prisma/dev.db || (echo "Falta prisma/dev.db" && exit 2)
	@test ! -e .container-data/financial.db || (echo ".container-data/financial.db ya existe; no se sobrescribe" && exit 2)
	mkdir -p .container-data
	sqlite3 prisma/dev.db ".timeout 5000" ".backup '.container-data/financial.db'"
	chmod 0600 .container-data/financial.db

container-up:
	mkdir -p .container-data
	$(CONTAINER_ENV) docker compose up --build --detach

container-status:
	$(CONTAINER_ENV) docker compose ps

container-logs:
	$(CONTAINER_ENV) docker compose logs --follow app

container-check:
	./deploy/scripts/smoke-test.sh "http://127.0.0.1:$(FINANCIAL_APP_HTTP_PORT)"
	$(CONTAINER_ENV) docker compose exec -T app sh -c 'test "$${DATABASE_URL}" = "file:/data/financial.db" && test "$${SESSION_COOKIE_SECURE}" = "false"'

container-down:
	$(CONTAINER_ENV) docker compose down

# Despliega origin/main en producción. Pide la contraseña de sudo del servidor.
deploy:
	@test "$$(git rev-parse --abbrev-ref HEAD)" = main || (echo "Despliega desde la rama main." && exit 2)
	@test -z "$$(git status --porcelain)" || (echo "Hay cambios sin commitear." && exit 2)
	git fetch origin main
	@test "$$(git rev-parse HEAD)" = "$$(git rev-parse origin/main)" || (echo "main local no coincide con origin/main: haz push o pull primero." && exit 2)
	ssh -t $(DEPLOY_HOST) 'cd $(DEPLOY_DIR) && git pull --ff-only origin main && deploy/scripts/update.sh'
