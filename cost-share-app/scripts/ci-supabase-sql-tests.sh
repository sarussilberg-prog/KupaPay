#!/usr/bin/env bash
# SQL regression tests (Phase 0 Gate B).
# CI: runs against **development** Postgres via pooler (SUPABASE_DEV_DB_PASSWORD).
# Each file ROLLBACKs — no persistent writes.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo "::error::SUPABASE_DB_PASSWORD is required (development CI secret)"
  exit 1
fi

export SUPABASE_ENV="${SUPABASE_ENV:-development}"

if ! command -v psql >/dev/null 2>&1; then
  echo "::error::psql not found"
  exit 1
fi

DB_URL="$(bash scripts/supabase-migration-db-url.sh)"

shopt -s nullglob
files=(supabase/__tests__/*.test.sql)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "::error::no SQL tests found"
  exit 1
fi

echo "▶ Running ${#files[@]} SQL tests on development (transaction rollback)"
for f in "${files[@]}"; do
  echo "▶ psql — $(basename "$f")"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f"
done

echo "✅ SQL integration tests passed (${#files[@]} files)"
