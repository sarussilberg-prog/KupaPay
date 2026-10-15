#!/usr/bin/env bash
# Local Supabase stack + SQL regression tests (Phase 0 Gate B).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v supabase >/dev/null 2>&1; then
  echo "::error::supabase CLI not found"
  exit 1
fi

supabase start -x studio,imgproxy,vector,logflare
trap 'supabase stop --no-backup 2>/dev/null || true' EXIT

supabase db reset --no-seed

DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
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
