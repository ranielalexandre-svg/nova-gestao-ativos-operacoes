#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.." || exit 1
source scripts/dev-processes-local.sh

SESSION="nova-dev"

echo "== ENCERRANDO TMUX =="
tmux kill-session -t "$SESSION" 2>/dev/null || true

echo
echo "== ENCERRANDO PROCESSOS LOCAIS =="
cleanup_dev_processes

echo
print_ports

echo
print_project_processes

echo
echo "Ambiente local encerrado."
