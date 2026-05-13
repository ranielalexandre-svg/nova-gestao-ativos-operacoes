#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.." || exit 1
source scripts/dev-processes-local.sh

SESSION="nova-dev"

mkdir -p "$RUN_LOG_DIR"

cat > apps/web/.env.local <<'ENVEOF'
API_BASE_URL_INTERNAL=http://127.0.0.1:4000
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4000
ENVEOF

echo "== LIMPANDO AMBIENTE LOCAL ANTERIOR =="
tmux kill-session -t "$SESSION" 2>/dev/null || true
cleanup_dev_processes

tmux new-session -d -s "$SESSION" -n api -c "$PROJECT"
tmux send-keys -t "$SESSION:api" "cd \"$PROJECT\" && corepack pnpm --dir apps/api start:dev 2>&1 | tee ${RUN_LOG_DIR}/api.log" C-m

echo
echo "== AGUARDANDO API EM ${API_PORT} =="
for _ in $(seq 1 60); do
  status="$(curl -s -o /dev/null -w "%{http_code}" "${API_BASE_URL}/auth/session" || true)"
  if [ "$status" = "401" ] || [ "$status" = "403" ] || [ "$status" = "200" ]; then
    echo "API pronta com status $status"
    break
  fi
  sleep 1
done

tmux new-window -t "$SESSION" -n web -c "$PROJECT"
tmux send-keys -t "$SESSION:web" "cd \"$PROJECT\" && corepack pnpm --dir apps/web dev --port \"$WEB_PORT\" 2>&1 | tee ${RUN_LOG_DIR}/web.log" C-m

wait_for_web 60 || true

echo
echo "== TMUX WINDOWS =="
tmux list-windows -t "$SESSION"

echo
print_ports

echo
echo "== TESTE API =="
curl -s -o /dev/null -w "API /auth/session -> HTTP %{http_code}\n" "${API_BASE_URL}/auth/session" || true

echo
echo "== TESTE WEB =="
curl -I "$WEB_BASE_URL" || true

echo
print_log "ULTIMAS LINHAS API" "${RUN_LOG_DIR}/api.log"

echo
print_log "ULTIMAS LINHAS WEB" "${RUN_LOG_DIR}/web.log"

echo
echo "Para acompanhar ao vivo:"
echo "  tmux attach -t $SESSION"
echo
echo "Para sair sem matar:"
echo "  Ctrl+B depois D"
