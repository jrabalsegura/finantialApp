#!/bin/sh
# Actualiza producción con el commit actual del checkout.
# Se ejecuta EN EL SERVIDOR (lo lanza `make deploy` desde el Mac) y pide sudo.
set -eu

cd "$(dirname "$0")/../.."

release=$(git rev-parse --short=12 HEAD)
database=/var/lib/financial-app/data/financial.db
backup_dir=/var/backups/financial-app
public_url=${FINANCIAL_APP_PUBLIC_URL:-https://finanzas.joserabalsegura.com}

if [ -n "$(git status --porcelain)" ]; then
  echo "El checkout del servidor tiene cambios locales; revísalos antes de desplegar." >&2
  exit 1
fi

echo "==> Construyendo imagen $release (el servicio sigue activo)"
sudo podman build --pull=always \
  --file deploy/containers/app.Containerfile \
  --tag "localhost/financial-app:$release" \
  .

backup="$backup_dir/pre-deploy-$(date -u +%Y%m%dT%H%M%SZ)-$release.db"
echo "==> Copia previa de SQLite: $backup"
sudo install -d -m 0700 "$backup_dir"
sudo sqlite3 "$database" ".timeout 5000" ".backup '$backup'"
test "$(sudo sqlite3 "$backup" 'PRAGMA integrity_check;')" = "ok"

echo "==> Moviendo current -> rollback y $release -> current"
if sudo podman image exists localhost/financial-app:current; then
  sudo podman tag localhost/financial-app:current localhost/financial-app:rollback
fi
sudo podman tag "localhost/financial-app:$release" localhost/financial-app:current

echo "==> Instalando Quadlet y reiniciando"
sudo install -m 0644 \
  deploy/quadlet/financial-app.container \
  /etc/containers/systemd/financial-app.container
sudo systemctl daemon-reload
sudo systemctl restart financial-app.service

deploy/scripts/smoke-test.sh http://127.0.0.1:3088
deploy/scripts/smoke-test.sh "$public_url"

cat <<EOF

Desplegado $release. Copia previa: $backup

Rollback de imagen (si no hubo migración incompatible):
  sudo podman tag localhost/financial-app:rollback localhost/financial-app:current
  sudo systemctl restart financial-app.service
EOF
