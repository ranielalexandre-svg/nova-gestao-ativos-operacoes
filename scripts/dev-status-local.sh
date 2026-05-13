#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.." || exit 1

echo "== PORTAS =="
ss -ltnp | grep -E ":3010|:4000" || true

echo
print_log() {
  local label="$1"
  local file="$2"

  echo "== ${label} =="
  if [ -f "$file" ]; then
    tail -n 30 "$file" || true
  else
    echo "Log ainda não existe: $file"
  fi
}

print_log "LOG API" ".run-logs/api.log"

echo
print_log "LOG WEB" ".run-logs/web.log"
