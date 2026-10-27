#!/usr/bin/env bash
# Fail if two migration files share the same numeric version prefix (Supabase schema_migrations.version).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$ROOT_DIR/supabase/migrations}"

declare -A SEEN=()
DUPLICATES=()

shopt -s nullglob
for f in "$MIGRATIONS_DIR"/*.sql; do
  base="$(basename "$f")"
  if [[ ! "$base" =~ ^([0-9]{14})_ ]]; then
    echo "⚠️  Skipping non-standard migration filename: $base"
    continue
  fi
  ver="${BASH_REMATCH[1]}"
  if [[ -n "${SEEN[$ver]:-}" ]]; then
    DUPLICATES+=("$ver: ${SEEN[$ver]} and $base")
  else
    SEEN[$ver]="$base"
  fi
done

if [[ ${#DUPLICATES[@]} -gt 0 ]]; then
  echo "❌ Duplicate Supabase migration version prefix(es) detected:"
  printf '  • %s\n' "${DUPLICATES[@]}"
  echo ""
  echo "Each file must have a unique 14-digit timestamp prefix (schema_migrations.version)."
  exit 1
fi

echo "✅ All migration version prefixes are unique (${#SEEN[@]} files)."
