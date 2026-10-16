#!/usr/bin/env bash
# Fail when two migration files share the same timestamp prefix (YYYYMMDDHHMMSS).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="$ROOT/supabase/migrations"
shopt -s nullglob
files=("$DIR"/*.sql)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "::error::no migration files"
  exit 1
fi
dupes=$(for f in "${files[@]}"; do basename "$f" | cut -d_ -f1; done | sort | uniq -d)
if [[ -n "$dupes" ]]; then
  echo "::error::duplicate migration timestamp prefix(es):"
  while IFS= read -r prefix; do
    [[ -z "$prefix" ]] && continue
    echo "  $prefix:"
    ls "$DIR"/"${prefix}"_*.sql 2>/dev/null | sed 's/^/    /'
  done <<< "$dupes"
  exit 1
fi
echo "✅ migration timestamp prefixes are unique"
