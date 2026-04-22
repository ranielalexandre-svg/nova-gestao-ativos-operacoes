#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== BUILD =="
corepack pnpm build

echo
echo "== PRODUCTION ARTIFACTS =="
test -f apps/api/dist/src/main.js
test -f apps/web/.next/BUILD_ID

echo
echo "== API TESTS =="
corepack pnpm test:api

echo
echo "== WEB LINT =="
corepack pnpm lint:web

echo
echo "Predeploy check finalizado."
