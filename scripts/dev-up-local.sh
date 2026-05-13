#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.." || exit 1
source scripts/dev-processes-local.sh

mkdir -p "$RUN_LOG_DIR" "$RUN_PID_DIR"

echo "== LIMPANDO AMBIENTE LOCAL ANTERIOR =="
cleanup_dev_processes

echo
echo "== SUBINDO AMBIENTE LOCAL =="
start_dev_server "API" "${RUN_PID_DIR}/api.pid" "${RUN_LOG_DIR}/api.log" \
  "cd \"$PROJECT\" && corepack pnpm dev:api"

start_dev_server "Web" "${RUN_PID_DIR}/web.pid" "${RUN_LOG_DIR}/web.log" \
  "cd \"$PROJECT\" && corepack pnpm dev:web"

echo
wait_for_url "API /health" "${API_BASE_URL}/health" 60 || true
wait_for_web 60 || true

echo
print_ports

echo
echo "== TESTE API =="
curl -I "${API_BASE_URL}/auth/session" || true

echo
echo "== TESTE WEB =="
curl -I "$WEB_BASE_URL" || true

echo
print_project_processes

echo
print_log "LOG API" "${RUN_LOG_DIR}/api.log"

echo
print_log "LOG WEB" "${RUN_LOG_DIR}/web.log"
