#!/usr/bin/env bash
# Before db push: fail fast when a pending local migration version already exists
# on remote (schema_migrations_pkey / renumbered file collisions).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DB_URL="$(bash scripts/supabase-migration-db-url.sh)"

list_out="$(supabase migration list --db-url "$DB_URL" 2>&1)" || {
  echo "$list_out" >&2
  exit 1
}

mapfile -t LOCAL_PENDING < <(
  echo "$list_out" | awk '
    $1 ~ /^[0-9]{14}$/ && ($3 == "" || $3 == "|") && $2 == "" { print $1 }
    $1 ~ /^[0-9]{14}$/ && $2 == "" { print $1 }
  ' | sort -u
)

# Fallback parse: lines where first column is version and second is empty before remote column
if [[ ${#LOCAL_PENDING[@]} -eq 0 ]]; then
  mapfile -t LOCAL_PENDING < <(
    echo "$list_out" | awk '/^[[:space:]]*[0-9]{14}/ {
      gsub(/^[[:space:]]+/, "", $1);
      if ($2 == "" || $2 == "│") print $1
    }'
  )
fi

if [[ ${#LOCAL_PENDING[@]} -eq 0 ]]; then
  echo "✅ No pending local migrations (remote precheck)."
  exit 0
fi

versions_csv="$(printf "'%s'," "${LOCAL_PENDING[@]}")"
versions_csv="${versions_csv%,}"

mapfile -t REMOTE_ROWS < <(
  psql "$DB_URL" -v ON_ERROR_STOP=1 -At -F $'\t' -c \
    "SELECT version, name FROM supabase_migrations.schema_migrations WHERE version IN (${versions_csv});"
)

if [[ ${#REMOTE_ROWS[@]} -eq 0 ]]; then
  echo "✅ Remote precheck: no version collisions for ${#LOCAL_PENDING[@]} pending migration(s)."
  exit 0
fi

for row in "${REMOTE_ROWS[@]}"; do
  ver="${row%%$'\t'*}"
  remote_name="${row#*$'\t'}"
  local_file="$(ls supabase/migrations/"${ver}"_*.sql 2>/dev/null | head -1 || true)"
  local_base=""
  [[ -n "$local_file" ]] && local_base="$(basename "$local_file")"
  echo "::error::Version ${ver} already on remote as '${remote_name}' but local pending file is '${local_base:-unknown}'"
done

echo ""
echo "Renumber local migration prefix or repair remote history (docs/SSOT/ROLLBACK_RUNBOOK.md)."
exit 1
