#!/usr/bin/env bash
# Enforce Supabase migration filename conventions (schema_migrations.version = 14-digit prefix).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$ROOT_DIR/supabase/migrations}"

shopt -s nullglob
files=("$MIGRATIONS_DIR"/*.sql)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "::error::No migration files under supabase/migrations"
  exit 1
fi

errors=0
for f in "${files[@]}"; do
  base="$(basename "$f")"
  if [[ ! "$base" =~ ^[0-9]{14}_[a-z0-9_]+\.sql$ ]]; then
    echo "::error::Invalid migration filename: $base"
    echo "  Expected: YYYYMMDDHHMMSS_snake_case_description.sql (14 digits, lowercase slug)"
    errors=$((errors + 1))
  fi
done

if [[ "$errors" -gt 0 ]]; then
  exit 1
fi

echo "✅ Migration filenames match naming rules (${#files[@]} files)."
