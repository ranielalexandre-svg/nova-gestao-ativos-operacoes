#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.." || exit 1
source scripts/dev-processes-local.sh

echo "== ENCERRANDO AMBIENTE LOCAL =="
cleanup_dev_processes

echo
print_ports

echo
print_project_processes

echo
echo "Processos locais encerrados."
