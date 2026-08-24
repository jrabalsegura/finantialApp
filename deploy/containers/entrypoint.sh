#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL es obligatoria." >&2
  exit 1
fi

case "$DATABASE_URL" in
  file:/data/*) ;;
  *)
    echo "DATABASE_URL debe apuntar al volumen persistente /data." >&2
    exit 1
    ;;
esac

if [ -z "${AUTH_SECRET:-}" ] || [ "${#AUTH_SECRET}" -lt 32 ]; then
  echo "AUTH_SECRET debe contener al menos 32 caracteres." >&2
  exit 1
fi

case "$AUTH_SECRET" in
  change-me-before-publishing|replace-with-at-least-32-random-bytes)
    echo "AUTH_SECRET conserva un valor de ejemplo inseguro." >&2
    exit 1
    ;;
esac

node_modules/.bin/prisma migrate deploy --schema /app/prisma/schema.prisma

exec "$@"
