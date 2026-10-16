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

echo "▶ profiles_select_scoped policy (no profile_visible_to_viewer oracle)"
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
  SELECT CASE
    WHEN pg_get_expr(p.polqual, p.polrelid) ILIKE '%profile_visible_to_viewer%' THEN
      'FAIL: profiles_select_scoped still calls profile_visible_to_viewer'
    WHEN NOT has_function_privilege(
      'authenticated',
      'app_private.profile_peer_visible_for_rls(uuid)',
      'EXECUTE'
    ) THEN
      'FAIL: missing EXECUTE on app_private.profile_peer_visible_for_rls'
    ELSE 'ok'
  END AS profiles_rls_check
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'profiles'
    AND p.polname = 'profiles_select_scoped';
"

echo "✅ Staging DB smoke passed"
