#!/usr/bin/env bash
# SQL regression tests (Phase 0 Gate B).
# CI: local Supabase stack (schema baseline + migrations), no remote secrets required.
# Each __tests__ file uses BEGIN/ROLLBACK — no persistent writes.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v supabase >/dev/null 2>&1; then
  echo "::error::supabase CLI not found"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "::error::psql not found"
  exit 1
fi

MIGRATIONS_DIR="$ROOT/supabase/migrations"
MIGRATIONS_HOLD="$(mktemp -d)"
SCHEMA_CORE_LINES=1038

cleanup() {
  supabase stop --no-backup 2>/dev/null || true
  if [[ -d "$MIGRATIONS_HOLD/migrations" ]]; then
    rm -rf "$MIGRATIONS_DIR"
    mv "$MIGRATIONS_HOLD/migrations" "$MIGRATIONS_DIR"
  fi
  rm -rf "$MIGRATIONS_HOLD"
}
trap cleanup EXIT

# `supabase start` auto-applies migrations on a fresh DB; history assumes schema.sql
# baseline first (see docs/PRO_V2_PLAN.md Gate B).
mv "$MIGRATIONS_DIR" "$MIGRATIONS_HOLD/migrations"
mkdir -p "$MIGRATIONS_DIR"

supabase start -x studio,imgproxy,vector,logflare

DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

rm -rf "$MIGRATIONS_DIR"
mv "$MIGRATIONS_HOLD/migrations" "$MIGRATIONS_DIR"

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
supabase migration up --local

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
