#!/usr/bin/env bash
set -euo pipefail

SESSION="nova-dev"
PROJECT="$(cd "$(dirname "$0")/.." && pwd)"

echo "== TMUX WINDOWS =="
tmux list-windows -t "$SESSION" 2>/dev/null || echo "Sessao tmux nao encontrada"

echo
echo "== PORTAS =="
ss -ltnp | grep -E ':4000|:3010' || true

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

print_log "LOG API" "$PROJECT/.run-logs/api.log"

echo
print_log "LOG WEB" "$PROJECT/.run-logs/web.log"
