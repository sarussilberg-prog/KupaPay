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
  shopt -s nullglob
  while IFS= read -r f; do
    [[ -n "$f" ]] && cat "$f"
  done < <(printf '%s\n' supabase/migrations/*.sql | sort)
}

scan_functions_json() {
  declare -A funcs=()
  shopt -s nocasematch
  while IFS= read -r line || [[ -n "${line:-}" ]]; do
    if [[ "$line" == *"drop function"* ]]; then
      if [[ "$line" =~ public\.([a-z0-9_]+) ]]; then
        unset "funcs[${BASH_REMATCH[1]}]"
      elif [[ "$line" =~ function[[:space:]]+([a-z0-9_]+) ]]; then
        unset "funcs[${BASH_REMATCH[1]}]"
      fi
    elif [[ "$line" =~ (function|procedure)[[:space:]]+(public\.)?([a-z0-9_]+)[[:space:]]*\( ]]; then
      funcs["${BASH_REMATCH[3]}"]=1
    fi
  done < <(collect_sql)
  shopt -u nocasematch
  local names=()
  local k
  for k in "${!funcs[@]}"; do names+=("$k"); done
  printf '%s\n' "${names[@]}" | sort -u | jq -R . | jq -s 'map({name: ., args: ""})'
}

TMP="$(mktemp)"
collect_sql > "$TMP"

extract_table_like_names() {
  grep -Eio 'create table (if not exists )?((public)\.)?[a-z][a-z0-9_]*' "$1" | grep -Eio '[a-z][a-z0-9_]*$'
  grep -Eio 'create (or replace )?view (public\.)?[a-z][a-z0-9_]*' "$1" | grep -Eio '[a-z][a-z0-9_]*$'
}

TABLES_JSON="$(
  extract_table_like_names "$TMP" | sort -u \
    | jq -R . | jq -s 'map({name: ., columns: []})'
)"

FUNCS_JSON="$(scan_functions_json)"

OUT="${SCHEMA_CONTRACT_SNAPSHOT:-supabase/ci/schema-contract.snapshot.json}"

jq -n \
  --arg desc "Offline seed (table/function names). CI compares name sets to post-bootstrap Postgres." \
  --arg generated "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson tables "$TABLES_JSON" \
  --argjson functions "$FUNCS_JSON" \
  '{description:$desc, generated_at:$generated, tables:$tables, functions:$functions}' \
  > "$OUT"

rm -f "$TMP"
echo "✅ Wrote $OUT ($(jq '.tables|length' "$OUT") tables, $(jq '.functions|length' "$OUT") functions)"
