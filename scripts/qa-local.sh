#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

WEB_PORT="${WEB_PORT:-3010}"
API_PORT="${API_PORT:-4000}"
WEB_BASE_URL="${WEB_BASE_URL:-http://127.0.0.1:${WEB_PORT}}"
API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:${API_PORT}}"
QA_FORCE_KILL="${QA_FORCE_KILL:-0}"

mkdir -p .tmp

port_pids() {
  local port="$1"

  ss -ltnp 2>/dev/null \
    | awk -v needle=":${port}" '$0 ~ needle { print }' \
    | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' \
    | sort -u || true
}

stop_pid_file() {
  local file="$1"
  local label="$2"
  local pid

  if [ ! -f "$file" ]; then
    return 0
  fi

  pid="$(cat "$file" 2>/dev/null || true)"
  if [ -z "$pid" ]; then
    return 0
  fi

  if kill -0 "$pid" 2>/dev/null; then
    echo "Encerrando ${label}: pid=${pid}"

    # Quando iniciado com setsid, o pid tambem e o process group id.
    kill -TERM "-${pid}" 2>/dev/null || true
    kill -TERM "$pid" 2>/dev/null || true
  fi
}

stop_port_processes() {
  local port="$1"
  local pids pid

  pids="$(port_pids "$port")"
  if [ -z "$pids" ]; then
    return 0
  fi

  echo "Porta ${port} ainda ocupada por: ${pids}"
  for pid in $pids; do
    echo "Encerrando processo da porta ${port}: pid=${pid}"
    kill -TERM "$pid" 2>/dev/null || true
  done
}

wait_ports_closed() {
  local attempts="${1:-10}"
  local busy

  for _ in $(seq 1 "$attempts"); do
    busy="$(port_pids "$WEB_PORT"; port_pids "$API_PORT")"
    if [ -z "$busy" ]; then
      return 0
    fi
    sleep 1
  done

  return 1
}

force_kill_ports_if_requested() {
  local pids pid

  if [ "$QA_FORCE_KILL" != "1" ]; then
    return 0
  fi

  pids="$(port_pids "$WEB_PORT"; port_pids "$API_PORT")"
  if [ -z "$pids" ]; then
    return 0
  fi

  echo "QA_FORCE_KILL=1: forçando encerramento dos processos restantes: ${pids}"
  for pid in $pids; do
    kill -KILL "$pid" 2>/dev/null || true
  done
}

cleanup() {
  set +e

  stop_pid_file ".tmp/api-preview-4000.pid" "API"
  stop_pid_file ".tmp/public-preview-3430.pid" "Web"

  sleep 2

  stop_port_processes "$API_PORT"
  stop_port_processes "$WEB_PORT"

  if ! wait_ports_closed 8; then
    force_kill_ports_if_requested
    wait_ports_closed 3 || true
  fi

  rm -rf .tmp
}

start_server() {
  local label="$1"
  local pid_file="$2"
  local log_file="$3"
  local command="$4"

  echo "Subindo ${label}..."
  if command -v setsid >/dev/null 2>&1; then
    setsid bash -lc "$command" > "$log_file" 2>&1 < /dev/null &
  else
    bash -lc "$command" > "$log_file" 2>&1 < /dev/null &
  fi

  echo $! > "$pid_file"
  echo "${label} pid=$(cat "$pid_file") log=${log_file}"
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

wait_for_web() {
  local attempts="${1:-60}"
  local status

  echo "Aguardando Web: ${WEB_BASE_URL}"
  for _ in $(seq 1 "$attempts"); do
    status="$(curl -s -o /dev/null -w "%{http_code}" "$WEB_BASE_URL" || true)"
    if [ "$status" = "200" ] || [ "$status" = "307" ] || [ "$status" = "308" ]; then
      echo "Web pronta com HTTP ${status}."
      return 0
    fi
    sleep 1
  done

  echo "Web nao respondeu dentro do tempo esperado."
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

start_server "API" ".tmp/api-preview-4000.pid" ".tmp/api-preview-4000.log" \
  "cd \"$(pwd)\" && corepack pnpm --dir apps/api start:dev"

start_server "Web" ".tmp/public-preview-3430.pid" ".tmp/public-preview-3430.log" \
  "cd \"$(pwd)\" && corepack pnpm --dir apps/web dev --port \"$WEB_PORT\""

wait_for_url "API /health" "${API_BASE_URL}/health" 60
wait_for_web 60

echo
echo "== PORTAS =="
ss -ltnp | grep -E ":${WEB_PORT}|:${API_PORT}" || true

echo
echo "== SMOKE LOCAL =="
WEB_BASE_URL="$WEB_BASE_URL" API_BASE_URL="$API_BASE_URL" corepack pnpm test:smoke

echo
echo "== LIMPANDO SERVIDORES TEMPORARIOS =="
cleanup
trap - EXIT INT TERM

echo
echo "== PORTAS APOS LIMPEZA =="
ss -ltnp | grep -E ":${WEB_PORT}|:${API_PORT}" || true

echo
echo "== STATUS FINAL =="
git status --short

echo
echo "QA local concluido com sucesso."
