#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.." || exit 1

kill_project_processes() {
  local pids
  pids="$(ps -eo pid=,cmd= | awk '
    /nova-gestao-ativos-operacoes\/apps\/api\/node_modules\/\.bin\/\.\.\/@nestjs\/cli\/bin\/nest\.js start --watch/ { print $1 }
    /nova-gestao-ativos-operacoes\/apps\/web\/node_modules\/\.bin\/\.\.\/next\/dist\/bin\/next dev --port 3010/ { print $1 }
    /corepack pnpm dev:api/ { print $1 }
    /corepack pnpm dev:web/ { print $1 }
    /corepack pnpm --dir apps\/api start:dev/ { print $1 }
    /corepack pnpm --dir apps\/web dev --port 3010/ { print $1 }
  ')"

  if [ -n "$pids" ]; then
    kill $pids 2>/dev/null || true
    sleep 1
    kill -9 $pids 2>/dev/null || true
  fi
}

if [ -f .run-pids/api.pid ]; then kill "$(cat .run-pids/api.pid)" 2>/dev/null || true; fi
if [ -f .run-pids/web.pid ]; then kill "$(cat .run-pids/web.pid)" 2>/dev/null || true; fi

pkill -f "nest start --watch" || true
pkill -f "next dev --port 3010" || true
kill_project_processes

if command -v fuser >/dev/null 2>&1; then
  fuser -k 3010/tcp >/dev/null 2>&1 || true
  fuser -k 4000/tcp >/dev/null 2>&1 || true
fi

echo "Processos locais encerrados."
