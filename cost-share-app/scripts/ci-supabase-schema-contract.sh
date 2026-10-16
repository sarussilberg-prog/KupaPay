#!/usr/bin/env bash
# Compare post-bootstrap public schema (tables + RPC args) to committed snapshot.
# Regenerate: GENERATE_SCHEMA_CONTRACT_SNAPSHOT=1 bash scripts/ci-supabase-schema-contract.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/ci-supabase-sql-lib.sh
source "$ROOT/scripts/ci-supabase-sql-lib.sh"

CONTAINER="${PG_CONTAINER:-kupapay-sql-ci-postgres}"
SNAPSHOT="${SCHEMA_CONTRACT_SNAPSHOT:-supabase/ci/schema-contract.snapshot.json}"
EXPORT_SQL="supabase/ci/schema-contract-export.sql"

if ! command -v jq >/dev/null 2>&1; then
  echo "::error::jq required" >&2
  exit 1
fi

if ! postgres_container_running; then
  echo "::error::Postgres container $CONTAINER not running — run ci-supabase-sql-bootstrap.sh first"
  exit 1
fi

psql_docker_file() {
  cat "$1" | docker exec -e PGPASSWORD=postgres -i "$CONTAINER" psql -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 -t -A -F '|' -f -
}

echo "▶ Exporting public schema contract from SQL CI Postgres"
EXPORT="$(psql_docker_file "$EXPORT_SQL")"

build_json() {
  local tmp_tables tmp_funcs
  tmp_tables="$(mktemp)"
  tmp_funcs="$(mktemp)"
  : >"$tmp_tables"
  : >"$tmp_funcs"
  while IFS='|' read -r kind a b c d; do
    [[ -z "${kind:-}" ]] && continue
    case "$kind" in
      table)
        printf '%s|%s|%s|%s\n' "$a" "$b" "$c" "$d" >>"$tmp_tables"
        ;;
      function)
        printf '%s|%s\n' "$a" "$b" >>"$tmp_funcs"
        ;;
    esac
  done <<< "$EXPORT"

  jq -n \
    --rawfile tables "$tmp_tables" \
    --rawfile funcs "$tmp_funcs" \
    --arg generated "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '
    ($tables | split("\n") | map(select(length > 0) | split("|")) | group_by(.[0]) | map({
      name: .[0][0],
      columns: map({name: .[1], type: .[2], nullable: .[3]})
    })) as $tableList |
    ($funcs | split("\n") | map(select(length > 0) | split("|")) | map({
      name: .[0],
      args: .[1]
    })) as $fnList |
    {
      description: "Public tables + RPC identity args after SQL CI bootstrap (matches supabase gen types surface).",
      generated_at: $generated,
      tables: $tableList,
      functions: $fnList
    }
    '
  rm -f "$tmp_tables" "$tmp_funcs"
}

LIVE_JSON="$(build_json)"

if [[ "${GENERATE_SCHEMA_CONTRACT_SNAPSHOT:-}" == "1" ]]; then
  echo "$LIVE_JSON" | jq . > "$SNAPSHOT"
  echo "✅ Wrote $SNAPSHOT (GENERATE_SCHEMA_CONTRACT_SNAPSHOT=1)"
  exit 0
fi

if [[ ! -f "$SNAPSHOT" ]]; then
  echo "::error::Missing $SNAPSHOT — run SQL CI bootstrap locally and GENERATE_SCHEMA_CONTRACT_SNAPSHOT=1"
  exit 1
fi

normalize_for_compare() {
  jq -S 'del(.generated_at, .description)
    | .tables |= map({name, columns: (.columns | sort_by(.name))})
    | .functions |= sort_by(.name, .args)' <<<"$1"
}

LIVE_NORM="$(normalize_for_compare "$LIVE_JSON")"
BASE_NORM="$(normalize_for_compare "$(cat "$SNAPSHOT")")"

# Offline-seeded snapshots use empty column lists — compare table/function identity only.
if jq -e '.tables | all(.columns | length == 0)' "$SNAPSHOT" >/dev/null 2>&1; then
  LIVE_NORM="$(echo "$LIVE_JSON" | jq -S 'del(.generated_at, .description)
    | {tables: ([.tables[].name] | sort), functions: ([.functions[].name] | unique | sort)}')"
  BASE_NORM="$(jq -S 'del(.generated_at, .description)
    | {tables: ([.tables[].name] | sort), functions: ([.functions[].name] | unique | sort)}' "$SNAPSHOT")"
fi

if [[ "$LIVE_NORM" == "$BASE_NORM" ]]; then
  echo "✅ Schema contract matches snapshot"
  exit 0
fi

echo "::error::Schema contract drift — update $SNAPSHOT (GENERATE_SCHEMA_CONTRACT_SNAPSHOT=1 after bootstrap)"
diff -u <(echo "$BASE_NORM" | jq .) <(echo "$LIVE_NORM" | jq .) || true
exit 1
