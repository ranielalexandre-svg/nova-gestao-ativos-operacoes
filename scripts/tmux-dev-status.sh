#!/usr/bin/env bash
set -euo pipefail

SESSION="nova-dev"

echo "== TMUX WINDOWS =="
tmux list-windows -t "$SESSION" 2>/dev/null || echo "Sessao tmux nao encontrada"

echo
echo "== PORTAS =="
ss -ltnp | grep -E ':4000|:3010' || true

echo
echo "== LOG API =="
tail -n 30 /home/raniel/projetos/nova-gestao-ativos-operacoes/.run-logs/api.log || true

echo
echo "== LOG WEB =="
tail -n 30 /home/raniel/projetos/nova-gestao-ativos-operacoes/.run-logs/web.log || true
