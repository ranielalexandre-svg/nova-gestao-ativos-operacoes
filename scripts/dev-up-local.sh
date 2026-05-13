#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.." || exit 1
PROJECT="$(pwd)"
mkdir -p .run-logs .run-pids

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

if command -v fuser >/dev/null 2>&1; then
  fuser -k 3010/tcp 2>/dev/null || true
  fuser -k 4000/tcp 2>/dev/null || true
fi

pkill -f "nest start --watch" || true
pkill -f "next dev --port 3010" || true
kill_project_processes

if command -v setsid >/dev/null 2>&1; then
  setsid bash -lc "cd \"$PROJECT\" && corepack pnpm dev:api" \
    > .run-logs/api.log 2>&1 < /dev/null &
else
  nohup bash -lc "cd \"$PROJECT\" && corepack pnpm dev:api" \
    > .run-logs/api.log 2>&1 < /dev/null &
fi
echo $! > .run-pids/api.pid

if command -v setsid >/dev/null 2>&1; then
  setsid bash -lc "cd \"$PROJECT\" && corepack pnpm dev:web" \
    > .run-logs/web.log 2>&1 < /dev/null &
else
  nohup bash -lc "cd \"$PROJECT\" && corepack pnpm dev:web" \
    > .run-logs/web.log 2>&1 < /dev/null &
fi
echo $! > .run-pids/web.pid

sleep 14

echo
echo "== PORTAS =="
ss -ltnp | grep -E ":3010|:4000" || true

echo
echo "== TESTE API =="
curl -I http://127.0.0.1:4000/auth/session || true

echo
echo "== TESTE WEB =="
curl -I http://127.0.0.1:3010 || true

echo
echo "== LOG API =="
tail -n 40 .run-logs/api.log || true

echo
echo "== LOG WEB =="
tail -n 40 .run-logs/web.log || true
