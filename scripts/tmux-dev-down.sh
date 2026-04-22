#!/usr/bin/env bash
set -euo pipefail

SESSION="nova-dev"

tmux kill-session -t "$SESSION" 2>/dev/null || true

if command -v fuser >/dev/null 2>&1; then
  fuser -k 4000/tcp 2>/dev/null || true
  fuser -k 3010/tcp 2>/dev/null || true
fi

pkill -f "nest start --watch" || true
pkill -f "next dev --port 3010" || true

echo "Ambiente local encerrado."
