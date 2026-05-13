#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.." || exit 1
source scripts/dev-processes-local.sh

print_ports

echo
print_project_processes

echo
print_log "LOG API" "${RUN_LOG_DIR}/api.log"

echo
print_log "LOG WEB" "${RUN_LOG_DIR}/web.log"
