#!/usr/bin/env bash
# CI helper: push migrations via pooler URL; reconcile history when remote has MCP-only versions.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DB_URL="$(bash scripts/supabase-migration-db-url.sh)"

local_versions() {
  local f base
  for f in supabase/migrations/*.sql; do
    [[ -f "$f" ]] || continue
    base="$(basename "$f" .sql)"
    echo "${base%%_*}"
  done
}

mark_local_applied() {
  local v
  for v in $(local_versions); do
    echo "▶ Marking migration $v as applied (if needed) ..."
    supabase migration repair --status applied "$v" --db-url "$DB_URL" --yes 2>/dev/null || true
  done
}

revert_remote_only() {
  local out
  out="$(supabase db push --db-url "$DB_URL" --dry-run 2>&1)" && return 0
  if ! grep -q 'migration repair --status reverted' <<<"$out"; then
    echo "$out" >&2
    return 1
  fi
  local ids
  ids="$(sed -n 's/.*migration repair --status reverted //p' <<<"$out" | head -1)"
  if [[ -z "$ids" ]]; then
    echo "$out" >&2
    return 1
  fi
  echo "▶ Reconciling remote-only migration history (schema unchanged) ..."
  # shellcheck disable=SC2086
  supabase migration repair --status reverted $ids --db-url "$DB_URL" --yes
}

revert_remote_only || true
mark_local_applied

echo "▶ Pushing pending migrations ..."
supabase db push --db-url "$DB_URL" --yes
