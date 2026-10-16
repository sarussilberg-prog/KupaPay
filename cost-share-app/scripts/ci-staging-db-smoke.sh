#!/usr/bin/env bash
# Post-deploy smoke against development DB (Phase 0 Gate B staging).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DB_URL="$(bash scripts/supabase-migration-db-url.sh)"

echo "▶ DB connectivity"
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "SELECT 1 AS ok"

echo "▶ Core relations"
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
  SELECT
    to_regclass('public.profiles') IS NOT NULL AS profiles,
    to_regclass('public.groups') IS NOT NULL AS groups,
    to_regclass('public.expenses') IS NOT NULL AS expenses,
    to_regclass('public.consolidation_batches') IS NOT NULL AS consolidation_batches;
"

echo "▶ Pro webhook RPC present"
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'handle_revenuecat_webhook'
  ) AS webhook_rpc;
"

echo "✅ Staging DB smoke passed"
