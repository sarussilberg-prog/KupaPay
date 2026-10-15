#!/usr/bin/env bash
# Local Supabase stack + SQL regression tests (Phase 0 Gate B).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v supabase >/dev/null 2>&1; then
  echo "::error::supabase CLI not found"
  exit 1
fi

MIGRATIONS_DIR="$ROOT/supabase/migrations"
MIGRATIONS_HOLD="$(mktemp -d)"
cleanup() {
  supabase stop --no-backup 2>/dev/null || true
  if [[ -d "$MIGRATIONS_HOLD/migrations" ]]; then
    rm -rf "$MIGRATIONS_DIR"
    mv "$MIGRATIONS_HOLD/migrations" "$MIGRATIONS_DIR"
  fi
  rm -rf "$MIGRATIONS_HOLD"
}
trap cleanup EXIT

# `supabase start` auto-applies migrations on a fresh DB; our history assumes
# schema.sql baseline first (see docs/SSOT/SUPABASE_ENVIRONMENTS.md).
mv "$MIGRATIONS_DIR" "$MIGRATIONS_HOLD/migrations"
mkdir -p "$MIGRATIONS_DIR"

supabase start -x studio,imgproxy,vector,logflare

DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

rm -rf "$MIGRATIONS_DIR"
mv "$MIGRATIONS_HOLD/migrations" "$MIGRATIONS_DIR"

echo "▶ Loading baseline schema.sql"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/schema.sql

echo "▶ Applying incremental migrations"
supabase migration up --local

shopt -s nullglob
files=(supabase/__tests__/*.test.sql)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "::error::no SQL tests found"
  exit 1
fi

for f in "${files[@]}"; do
  echo "▶ psql — $(basename "$f")"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f"
done

echo "✅ SQL integration tests passed (${#files[@]} files)"
