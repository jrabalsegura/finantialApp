#!/bin/sh
# Baja al Mac los backups exportados por el servidor y verifica el más reciente.
# Uso manual: make backup-pull. Programado: make backup-schedule (launchd, diario).
set -eu
umask 077

host=${FINANCIAL_APP_BACKUP_HOST:-remote}
remote_dir=${FINANCIAL_APP_BACKUP_REMOTE_DIR:-financial-app-backups}
local_dir=${FINANCIAL_APP_BACKUP_LOCAL_DIR:-$HOME/Backups/finanzas}
retention_days=${FINANCIAL_APP_BACKUP_LOCAL_RETENTION_DAYS:-90}

fail() {
  echo "ERROR: $1" >&2
  osascript -e "display notification \"$1\" with title \"Backup Finanzas\"" \
    >/dev/null 2>&1 || true
  exit 1
}

mkdir -p "$local_dir"
rsync -a --ignore-existing \
  -e "ssh -o BatchMode=yes -o ConnectTimeout=15" \
  "$host:$remote_dir/" "$local_dir/" \
  || fail "No se pudieron descargar los backups de $host."

latest=$(ls -t "$local_dir"/financial-app-*.tar.gz 2>/dev/null | head -n 1)
[ -n "$latest" ] || fail "No hay ningún backup en $local_dir."

temporary_dir=$(mktemp -d)
trap 'rm -rf "$temporary_dir"' EXIT
tar -xzf "$latest" -C "$temporary_dir" var/lib/financial-app/data/financial.db \
  || fail "El backup $(basename "$latest") no se puede extraer."
[ "$(sqlite3 "$temporary_dir/var/lib/financial-app/data/financial.db" \
  'PRAGMA integrity_check;')" = "ok" ] \
  || fail "El backup $(basename "$latest") no supera integrity_check."

# El servidor copia a diario: más de 2 días sin copia nueva indica un fallo allí.
[ -z "$(find "$latest" -mtime +2)" ] \
  || fail "El último backup ($(basename "$latest")) tiene más de 2 días."

find "$local_dir" -type f -name 'financial-app-*.tar.gz' \
  -mtime "+$retention_days" -delete

echo "$(date '+%Y-%m-%d %H:%M') backup verificado: $latest"
