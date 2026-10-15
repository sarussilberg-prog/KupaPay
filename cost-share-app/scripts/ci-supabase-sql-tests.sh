#!/usr/bin/env bash
# SQL regression tests (Phase 0 Gate B).
# CI: Postgres 17 container (schema baseline + patches + migrations), no remote secrets.
# Each __tests__ file uses BEGIN/ROLLBACK — no persistent writes.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v psql >/dev/null 2>&1; then
  echo "::error::psql not found"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "::error::docker not found"
  exit 1
fi

PG_CONTAINER="kupapay-sql-ci-postgres"
PG_IMAGE="postgres:17-alpine"
PG_PORT=54322
SCHEMA_CORE_LINES=1038

cleanup() {
  docker rm -f "$PG_CONTAINER" 2>/dev/null || true
}
trap cleanup EXIT

echo "▶ Starting Postgres (${PG_IMAGE}) on port ${PG_PORT}"
docker rm -f "$PG_CONTAINER" 2>/dev/null || true
docker run -d --name "$PG_CONTAINER" \
  -e POSTGRES_PASSWORD=postgres \
  -p "${PG_PORT}:5432" \
  "$PG_IMAGE" >/dev/null

for _ in $(seq 1 60); do
  if docker exec "$PG_CONTAINER" pg_isready -U postgres -q 2>/dev/null; then
    break
  fi
  sleep 1
done
docker exec "$PG_CONTAINER" pg_isready -U postgres -q

DB_URL="postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/postgres"

echo "▶ Loading baseline schema.sql (core DDL, first ${SCHEMA_CORE_LINES} lines)"
# Tail of schema.sql defines archive/admin RPCs that depend on columns from migrations.
head -n "$SCHEMA_CORE_LINES" supabase/schema.sql | psql "$DB_URL" -v ON_ERROR_STOP=1 -f -

# Same order as scripts/supabase-apply-patches.sh (remote dev bootstrap).
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
for patch in "${PATCH_FILES[@]}"; do
  echo "▶ patch — $(basename "$patch")"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$patch"
done

echo "▶ Applying incremental migrations"
shopt -s nullglob
migration_files=(supabase/migrations/*.sql)
IFS=$'\n' migration_files_sorted=($(printf '%s\n' "${migration_files[@]}" | sort))
unset IFS
for f in "${migration_files_sorted[@]}"; do
  echo "▶ migration — $(basename "$f")"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f"
done

shopt -s nullglob
files=(supabase/__tests__/*.test.sql)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "::error::no SQL tests found"
  exit 1
fi

# Skipped locally — run on development DB post-deploy (#180):
# - activity_events: dev trigger parity (membership rejoin clears group_removed)
# - get_group_pairwise_debts: RPC dropped in 20260617200000_drop_legacy_balance_rpcs
LOCAL_SKIP=(
  activity_events.test.sql
  get_group_pairwise_debts.test.sql
)

ran=0
skipped=0
echo "▶ Running SQL tests (transaction rollback)"
for f in "${files[@]}"; do
  base="$(basename "$f")"
  if [[ " ${LOCAL_SKIP[*]} " == *" ${base} "* ]]; then
    echo "▶ skip — ${base} (full run on development DB post-deploy)"
    skipped=$((skipped + 1))
    continue
  fi
  echo "▶ psql — ${base}"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f"
  ran=$((ran + 1))
done

echo "✅ SQL integration tests passed (${ran} files, ${skipped} skipped locally)"
