#!/usr/bin/env bash
set -euo pipefail

cd /home/raniel/projetos/nova-gestao-ativos-operacoes || exit 1

echo "== PORTAS =="
ss -ltnp | grep -E ":3010|:4000" || true

echo
echo "== LOG API =="
tail -n 30 .run-logs/api.log || true

echo
echo "== LOG WEB =="
tail -n 30 .run-logs/web.log || true
