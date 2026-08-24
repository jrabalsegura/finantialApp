#!/bin/sh
set -eu

base_url=${1:-http://127.0.0.1:3080}
temporary_dir=$(mktemp -d "${TMPDIR:-/tmp}/financial-app-smoke.XXXXXX")
trap 'rm -rf "$temporary_dir"' EXIT HUP INT TERM

attempt=1
while ! curl --fail --silent --show-error \
  --connect-timeout 2 \
  --max-time 5 \
  "$base_url/api/health" >"$temporary_dir/health.json" \
  2>"$temporary_dir/curl-error"; do
  if [ "$attempt" -ge 30 ]; then
    cat "$temporary_dir/curl-error" >&2
    echo "La aplicación no respondió al healthcheck en 30 intentos." >&2
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep 1
done

curl --fail --silent --show-error \
  "$base_url/login" >"$temporary_dir/login.html"

node -e '
  const fs = require("node:fs");
  const payload = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (payload.status !== "ok" || payload.database !== "ok") process.exit(1);
' "$temporary_dir/health.json"

grep -q '<html lang="es">' "$temporary_dir/login.html"
grep -q 'Finanzas personales' "$temporary_dir/login.html"

printf 'Smoke test correcto: %s\n' "$base_url"
