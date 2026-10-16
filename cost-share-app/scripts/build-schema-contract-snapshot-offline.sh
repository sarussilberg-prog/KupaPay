#!/usr/bin/env bash
# Seed schema-contract.snapshot.json from SQL CI bootstrap inputs (no live DB).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SCHEMA_CORE_LINES=1038
PATCH_FILES=(
  supabase/fix-rls-group-members-recursion.sql
  supabase/fix-is-group-member-anon-grants.sql
  supabase/get-user-dashboard.sql
  supabase/get-user-balance-summary.sql
  supabase/account-deletion-v2.sql
  supabase/account-deletion-v3-fixes.sql
  supabase/fix-profiles-account-deactivation.sql
  supabase/fix-groups-select-creator.sql
  supabase/friends-system.sql
  supabase/group-messages.sql
  supabase/invite-links.sql
  supabase/legal-documents.sql
  supabase/settle-up-v1.sql
)

collect_sql() {
  head -n "$SCHEMA_CORE_LINES" supabase/schema.sql
  for p in "${PATCH_FILES[@]}"; do cat "$p"; done
  cat supabase/migrations/*.sql
}

TMP="$(mktemp)"
collect_sql > "$TMP"

TABLES_JSON="$(rg -o 'CREATE TABLE (IF NOT EXISTS )?public\.([a-z0-9_]+)' "$TMP" -r '$2' | sort -u | jq -R . | jq -s 'map({name: ., columns: []})')"

FUNCS_JSON="$(
  rg -o 'CREATE OR REPLACE FUNCTION public\.([a-z0-9_]+)\(([^)]*)\)' "$TMP" \
    | while read -r line; do
        name="$(sed -n 's/.*public\.\([a-z0-9_]*\)(.*/\1/p' <<<"$line")"
        args="$(sed -n 's/.*(\(.*\)).*/\1/p' <<<"$line" | tr '[:space:]' ' ' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr 'A-Z' 'a-z')"
        jq -n --arg n "$name" --arg a "$args" '{name:$n,args:$a}'
      done | jq -s 'unique_by(.name + "|" + .args) | sort_by(.name,.args)'
)"

jq -n \
  --arg desc "Offline seed (table/function names). CI exports full columns from Postgres and must match when GENERATE_SCHEMA_CONTRACT_SNAPSHOT=1 refresh is committed." \
  --arg generated "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson tables "$TABLES_JSON" \
  --argjson functions "$FUNCS_JSON" \
  '{description:$desc, generated_at:$generated, tables:$tables, functions:$functions}' \
  > supabase/ci/schema-contract.snapshot.json

rm -f "$TMP"
echo "✅ Wrote supabase/ci/schema-contract.snapshot.json"
