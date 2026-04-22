#!/usr/bin/env bash
set -euo pipefail

PROJECT="/home/raniel/projetos/nova-gestao-ativos-operacoes"
SESSION="nova-dev"

cd "$PROJECT" || exit 1
mkdir -p .run-logs

cat > apps/web/.env.local <<'ENVEOF'
API_BASE_URL_INTERNAL=http://127.0.0.1:4000
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4000
ENVEOF

if command -v fuser >/dev/null 2>&1; then
  fuser -k 4000/tcp 2>/dev/null || true
  fuser -k 3010/tcp 2>/dev/null || true
fi

pkill -f "nest start --watch" || true
pkill -f "next dev --port 3010" || true

tmux kill-session -t "$SESSION" 2>/dev/null || true

tmux new-session -d -s "$SESSION" -n api -c "$PROJECT"
tmux send-keys -t "$SESSION:api" "cd $PROJECT && corepack pnpm --dir apps/api start:dev 2>&1 | tee .run-logs/api.log" C-m

echo
echo "== AGUARDANDO API EM 4000 =="
for i in $(seq 1 60); do
  if curl -fsS -o /dev/null http://127.0.0.1:4000/auth/session 2>/dev/null; then
    echo "API respondeu em /auth/session"
    break
  fi
  status="$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/auth/session || true)"
  if [ "$status" = "401" ] || [ "$status" = "403" ] || [ "$status" = "200" ]; then
    echo "API pronta com status $status"
    break
  fi
  sleep 1
done

tmux new-window -t "$SESSION" -n web -c "$PROJECT"
tmux send-keys -t "$SESSION:web" "cd $PROJECT && corepack pnpm --dir apps/web dev --port 3010 2>&1 | tee .run-logs/web.log" C-m

sleep 8

echo
echo "== TMUX WINDOWS =="
tmux list-windows -t "$SESSION"

echo
echo "== PORTAS =="
ss -ltnp | grep -E ':4000|:3010' || true

echo
echo "== TESTE API =="
curl -s -o /dev/null -w "API /auth/session -> HTTP %{http_code}\n" http://127.0.0.1:4000/auth/session || true

echo
echo "== TESTE WEB =="
curl -I http://127.0.0.1:3010 || true

echo
echo "== ULTIMAS LINHAS API =="
tail -n 30 .run-logs/api.log || true

echo
echo "== ULTIMAS LINHAS WEB =="
tail -n 30 .run-logs/web.log || true

echo
echo "Para acompanhar ao vivo:"
echo "  tmux attach -t $SESSION"
echo
echo "Para sair sem matar:"
echo "  Ctrl+B depois D"
