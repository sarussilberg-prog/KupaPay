#!/usr/bin/env bash
# Compare remote schema_migrations to repo migration files (staging/prod deploy guard).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DB_URL="$(bash scripts/supabase-migration-db-url.sh)"
MIGRATIONS_DIR="$ROOT_DIR/supabase/migrations"

mapfile -t LOCAL_VERSIONS < <(
  shopt -s nullglob
  for f in "$MIGRATIONS_DIR"/*.sql; do basename "$f" | cut -d_ -f1; done | sort -u
)

mapfile -t REMOTE_ROWS < <(
  psql "$DB_URL" -v ON_ERROR_STOP=1 -At -F $'\t' -c \
    "SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;"
)

declare -A REMOTE_NAME=()
for row in "${REMOTE_ROWS[@]}"; do
  ver="${row%%$'\t'*}"
  name="${row#*$'\t'}"
  REMOTE_NAME["$ver"]="$name"
done

remote_only=()
local_only=()
name_mismatch=()

for ver in "${!REMOTE_NAME[@]}"; do
  local_file="$(ls "$MIGRATIONS_DIR/${ver}"_*.sql 2>/dev/null | head -1 || true)"
  if [[ -z "$local_file" ]]; then
    remote_only+=("$ver (${REMOTE_NAME[$ver]})")
    continue
  fi
  local_base="$(basename "$local_file" .sql)"
  local_slug="${local_base#${ver}_}"
  remote_slug="${REMOTE_NAME[$ver]%.sql}"
  remote_slug="${remote_slug#${ver}_}"
  if [[ "$local_slug" != "$remote_slug" && "${REMOTE_NAME[$ver]}" != "$local_base" ]]; then
    name_mismatch+=("$ver remote='${REMOTE_NAME[$ver]}' local='$(basename "$local_file")'")
  fi
done

for ver in "${LOCAL_VERSIONS[@]}"; do
  [[ -n "${REMOTE_NAME[$ver]:-}" ]] && continue
  local_only+=("$ver")
done

failed=0
if [[ ${#remote_only[@]} -gt 0 ]]; then
  echo "::error::Remote-only migration versions (not in repo):"
  printf '  • %s\n' "${remote_only[@]}"
  failed=1
fi
if [[ ${#name_mismatch[@]} -gt 0 ]]; then
  echo "::error::Migration version/name mismatch:"
  printf '  • %s\n' "${name_mismatch[@]}"
  failed=1
fi

if [[ ${#local_only[@]} -gt 0 ]]; then
  echo "ℹ️  Pending local migrations not yet on remote: ${#local_only[@]}"
fi

if [[ "$failed" -ne 0 ]]; then
  echo "Fix drift before push (docs/SSOT/ROLLBACK_RUNBOOK.md)."
  exit 1
fi

echo "✅ Migration history aligned with repo (${#LOCAL_VERSIONS[@]} local versions, ${#REMOTE_ROWS[@]} remote)."
