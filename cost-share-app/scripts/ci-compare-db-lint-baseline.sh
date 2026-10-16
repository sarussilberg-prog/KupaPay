#!/usr/bin/env bash
# Run Splinter-style lints in an already-bootstrapped SQL CI Postgres container.
# Usage: ci-compare-db-lint-baseline.sh <container_name> [pg_user]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CONTAINER="${1:?container name required}"
PGUSER="${2:-supabase_admin}"
BASELINE_FILE="supabase/ci/db-lint-baseline.json"
LINT_SQL="supabase/ci/db-lint-run.sql"

if ! command -v jq >/dev/null 2>&1; then
  echo "::error::jq not found"
  exit 1
fi

psql_docker_file() {
  cat "$1" | docker exec -e PGPASSWORD=postgres -i "$CONTAINER" psql -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 -t -A -F '|' -f -
}

echo "▶ DB lints (performance + security)"
if ! EXPORT="$(psql_docker_file "$LINT_SQL")"; then
  echo "::error::DB lint SQL failed"
  exit 1
fi

if [[ -z "${EXPORT//[$'\n ']/}" ]]; then
  echo "✅ No DB lint violations"
  exit 0
fi

if [[ "${GENERATE_DB_LINT_BASELINE:-}" == "1" ]]; then
  OUT_FILE="${DB_LINT_BASELINE_OUT:-supabase/ci/db-lint-baseline.json}"
  tmp="$(mktemp)"
  while IFS='|' read -r lint_type cache_key; do
    [[ -z "$lint_type" ]] && continue
    echo "$lint_type|$cache_key"
  done <<< "$EXPORT" > "$tmp"
  jq -n \
    --slurpfile lines "$tmp" \
    --arg desc "Generated from local SQL CI (GENERATE_DB_LINT_BASELINE=1)" \
    '{
      description: $desc,
      enforce: {
        unindexed_foreign_keys: true,
        auth_rls_initplan: true,
        rls_filter_columns_missing_index: true
      },
      unindexed_foreign_keys: [],
      auth_rls_initplan: [],
      rls_filter_columns_missing_index: []
    }
    | reduce ($lines | split("\n") | map(select(length > 0) | split("|")) | .[]) as $row (.;
        .[$row[0]] += [$row[1]]
      )' > "$OUT_FILE"
  rm -f "$tmp"
  echo "✅ Wrote baseline to $OUT_FILE"
  exit 0
fi

valid_lint_re='^(unindexed_foreign_keys|auth_rls_initplan|rls_filter_columns_missing_index)$'

fail=0
while IFS='|' read -r lint_type cache_key; do
  [[ -z "$lint_type" ]] && continue
  if ! [[ "$lint_type" =~ $valid_lint_re ]]; then
    continue
  fi
  enforced="$(jq -r --arg t "$lint_type" '.enforce[$t] // false' "$BASELINE_FILE")"
  if [[ "$enforced" != "true" ]]; then
    echo "::warning::DB lint ($lint_type): $cache_key (not enforced yet — see db-lint-baseline.json enforce)"
    continue
  fi
  allowed="$(jq -r --arg t "$lint_type" --arg k "$cache_key" '
    (.[$t] // []) | index($k) != null
  ' "$BASELINE_FILE")"
  if [[ "$allowed" != "true" ]]; then
    echo "::error::New DB lint violation ($lint_type): $cache_key"
    fail=1
  fi
done <<< "$EXPORT"

if [[ "$fail" -ne 0 ]]; then
  echo "Grandfather existing findings in $BASELINE_FILE only when intentional."
  exit 1
fi

echo "✅ DB lints passed (only baseline violations present)"
