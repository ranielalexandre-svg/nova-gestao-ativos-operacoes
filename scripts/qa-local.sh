#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

WEB_PORT="${WEB_PORT:-3010}"
API_PORT="${API_PORT:-4000}"
WEB_BASE_URL="${WEB_BASE_URL:-http://127.0.0.1:${WEB_PORT}}"
API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:${API_PORT}}"

mkdir -p .tmp

kill_ports() {
  local pids

  if [ -f .tmp/api-preview-4000.pid ]; then
    kill "$(cat .tmp/api-preview-4000.pid)" 2>/dev/null || true
  fi

  if [ -f .tmp/public-preview-3430.pid ]; then
    kill "$(cat .tmp/public-preview-3430.pid)" 2>/dev/null || true
  fi

  pids="$(ss -ltnp 2>/dev/null | grep -E ":${WEB_PORT}|:${API_PORT}" | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u || true)"
  if [ -n "$pids" ]; then
    echo "$pids" | xargs -r kill 2>/dev/null || true
    sleep 2
  fi

  pids="$(ss -ltnp 2>/dev/null | grep -E ":${WEB_PORT}|:${API_PORT}" | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u || true)"
  if [ -n "$pids" ]; then
    echo "$pids" | xargs -r kill -9 2>/dev/null || true
  fi
}

cleanup() {
  kill_ports
  rm -rf .tmp
}

wait_for_url() {
  local label="$1"
  local url="$2"
  local attempts="${3:-60}"

  echo "Aguardando ${label}: ${url}"
  for _ in $(seq 1 "$attempts"); do
    if curl -fsS -o /dev/null "$url" 2>/dev/null; then
      echo "${label} pronto."
      return 0
    fi
    sleep 1
  done

  echo "${label} nao respondeu dentro do tempo esperado."
  return 1
}

trap cleanup EXIT INT TERM

echo "== CONTEXTO =="
git status --short
git branch --show-current

echo
echo "== CHECK SCRIPT SMOKE =="
node --check scripts/smoke-web-routes.mjs

echo
echo "== TEST ALL =="
corepack pnpm test:all

echo
echo "== BUILD WEB =="
corepack pnpm build:web

echo
echo "== BUILD API =="
corepack pnpm build:api

echo
echo "== AUDITORIA =="
corepack pnpm audit:modules

echo
echo "== DIFF CHECK =="
git diff --check

echo
echo "== SUBINDO API/WEB PARA SMOKE =="
cleanup
mkdir -p .tmp

corepack pnpm --dir apps/api start:dev > .tmp/api-preview-4000.log 2>&1 &
echo $! > .tmp/api-preview-4000.pid

corepack pnpm --dir apps/web dev --port "$WEB_PORT" > .tmp/public-preview-3430.log 2>&1 &
echo $! > .tmp/public-preview-3430.pid

wait_for_url "API /health" "${API_BASE_URL}/health" 60

echo "Aguardando Web: ${WEB_BASE_URL}"
for _ in $(seq 1 60); do
  status="$(curl -s -o /dev/null -w "%{http_code}" "${WEB_BASE_URL}" || true)"
  if [ "$status" = "200" ] || [ "$status" = "307" ] || [ "$status" = "308" ]; then
    echo "Web pronta com HTTP ${status}."
    break
  fi
  sleep 1
done

echo
echo "== PORTAS =="
ss -ltnp | grep -E ":${WEB_PORT}|:${API_PORT}" || true

echo
echo "== SMOKE LOCAL =="
WEB_BASE_URL="$WEB_BASE_URL" API_BASE_URL="$API_BASE_URL" corepack pnpm test:smoke

echo
echo "== STATUS FINAL =="
git status --short

echo
echo "QA local concluido com sucesso."
