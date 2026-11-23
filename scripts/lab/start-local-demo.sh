#!/usr/bin/env bash
# One command for the lab demo on a LOCAL copy of the database (never touches the online project).
# Needs Docker running. Usage: bash scripts/lab/start-local-demo.sh   then open http://localhost:3107
set -euo pipefail
cd "$(dirname "$0")/../.."

supabase start > /dev/null 2>&1 || true
supabase status -o env > .env.demo-status
set -a; source .env.demo-status; set +a

# A throwaway password for the local test accounts, created once and kept in a git-ignored file.
if [ ! -f .env.demo ]; then
  echo "DSS_TEST_PASSWORD=Demo-$(openssl rand -base64 9 | tr -d '/+=')9!" > .env.demo
  export DSS_RESET_PASSWORDS=1
fi
set -a; source .env.demo; set +a

export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres?sslmode=disable"
export DSS_DEV_SEED=1

npx tsx scripts/lab/demo-day.ts
echo "Starting the app on http://localhost:3107 (local database). Press Ctrl+C to stop."
exec npx next dev -p 3107
