FINANCIAL_APP_HTTP_PORT ?= 3080
FINANCIAL_APP_UID := $(shell id -u)
FINANCIAL_APP_GID := $(shell id -g)
CONTAINER_ENV := FINANCIAL_APP_HTTP_PORT=$(FINANCIAL_APP_HTTP_PORT) FINANCIAL_APP_UID=$(FINANCIAL_APP_UID) FINANCIAL_APP_GID=$(FINANCIAL_APP_GID)

.PHONY: check container-build container-import-db container-up container-status container-logs container-check container-down

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
