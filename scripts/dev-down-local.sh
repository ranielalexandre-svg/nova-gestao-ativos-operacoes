#!/usr/bin/env bash
set -euo pipefail

cd /home/raniel/projetos/nova-gestao-ativos-operacoes || exit 1

if [ -f .run-pids/api.pid ]; then kill "$(cat .run-pids/api.pid)" 2>/dev/null || true; fi
if [ -f .run-pids/web.pid ]; then kill "$(cat .run-pids/web.pid)" 2>/dev/null || true; fi

pkill -f "nest start --watch" || true
pkill -f "next dev --port 3010" || true

if command -v fuser >/dev/null 2>&1; then
  fuser -k 3010/tcp 2>/dev/null || true
  fuser -k 4000/tcp 2>/dev/null || true
fi

echo "Processos locais encerrados."
