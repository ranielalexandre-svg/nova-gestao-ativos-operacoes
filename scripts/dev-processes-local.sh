#!/usr/bin/env bash

# Biblioteca compartilhada pelos scripts locais de desenvolvimento.
# Deve ser usada via source, nao executada diretamente.

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_PORT="${WEB_PORT:-3010}"
API_PORT="${API_PORT:-4000}"
WEB_BASE_URL="${WEB_BASE_URL:-http://127.0.0.1:${WEB_PORT}}"
API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:${API_PORT}}"
LOCAL_DEV_FORCE_KILL="${LOCAL_DEV_FORCE_KILL:-0}"

RUN_LOG_DIR="${RUN_LOG_DIR:-.run-logs}"
RUN_PID_DIR="${RUN_PID_DIR:-.run-pids}"

port_pids() {
  local port="$1"

  ss -ltnp 2>/dev/null \
    | awk -v needle=":${port}" '$0 ~ needle { print }' \
    | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' \
    | sort -u || true
}

project_process_pids() {
  ps -eo pid=,cmd= | awk -v project="$PROJECT" '
    index($0, project) && /corepack pnpm dev:api/ { print $1 }
    index($0, project) && /corepack pnpm dev:web/ { print $1 }
    index($0, project) && /corepack pnpm --dir apps\/api start:dev/ { print $1 }
    index($0, project) && /corepack pnpm --dir apps\/web dev --port/ { print $1 }
    index($0, project) && /apps\/api\/node_modules\/\.bin\/\.\.\/@nestjs\/cli\/bin\/nest\.js start --watch/ { print $1 }
    index($0, project) && /apps\/web\/node_modules\/\.bin\/\.\.\/next\/dist\/bin\/next dev --port/ { print $1 }
    index($0, project) && /next-server/ { print $1 }
  ' | sort -u || true
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
    kill -TERM "-${pid}" 2>/dev/null || true
    kill -TERM "$pid" 2>/dev/null || true
  fi
}

stop_pids() {
  local label="$1"
  shift || true

  if [ "$#" -eq 0 ]; then
    return 0
  fi

  echo "Encerrando ${label}: $*"
  for pid in "$@"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
}

stop_project_processes() {
  local pids

  pids="$(project_process_pids)"
  if [ -n "$pids" ]; then
    # shellcheck disable=SC2086
    stop_pids "processos do projeto" $pids
  fi
}

stop_port_processes() {
  local port="$1"
  local pids

  pids="$(port_pids "$port")"
  if [ -n "$pids" ]; then
    echo "Porta ${port} ocupada por: ${pids}"
    # shellcheck disable=SC2086
    stop_pids "porta ${port}" $pids
  fi
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

  if [ "$LOCAL_DEV_FORCE_KILL" != "1" ]; then
    return 0
  fi

  pids="$(port_pids "$WEB_PORT"; port_pids "$API_PORT")"
  if [ -z "$pids" ]; then
    return 0
  fi

  echo "LOCAL_DEV_FORCE_KILL=1: forçando encerramento: ${pids}"
  for pid in $pids; do
    kill -KILL "$pid" 2>/dev/null || true
  done
}

cleanup_dev_processes() {
  set +e

  stop_pid_file "${RUN_PID_DIR}/api.pid" "API"
  stop_pid_file "${RUN_PID_DIR}/web.pid" "Web"

  sleep 2

  stop_project_processes
  stop_port_processes "$API_PORT"
  stop_port_processes "$WEB_PORT"

  if ! wait_ports_closed 8; then
    force_kill_ports_if_requested
    wait_ports_closed 3 || true
  fi
}

start_dev_server() {
  local label="$1"
  local pid_file="$2"
  local log_file="$3"
  local command="$4"

  mkdir -p "$(dirname "$pid_file")" "$(dirname "$log_file")"

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

print_ports() {
  echo "== PORTAS =="
  ss -ltnp | grep -E ":${WEB_PORT}|:${API_PORT}" || true
}

print_project_processes() {
  echo "== PROCESSOS NODE RELACIONADOS =="
  ps -eo pid,ppid,stat,cmd \
    | grep -E 'pnpm|next-server|nest|node' \
    | grep -v grep \
    | grep "$PROJECT" \
    | sed -n '1,160p' || true
}

print_log() {
  local label="$1"
  local file="$2"

  echo "== ${label} =="
  if [ -f "$file" ]; then
    tail -n 30 "$file" || true
  else
    echo "Log ainda nao existe: $file"
  fi
}
