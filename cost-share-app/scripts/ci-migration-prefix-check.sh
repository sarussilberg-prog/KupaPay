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
# Grandfathered duplicates already applied on dev (renaming would re-run migrations).
KNOWN_DUPES=(20261016120000 20261016130000)

dupes=$(for f in "${files[@]}"; do basename "$f" | cut -d_ -f1; done | sort | uniq -d)
if [[ -n "$dupes" ]]; then
  blocked=0
  while IFS= read -r prefix; do
    [[ -z "$prefix" ]] && continue
    known_dup=0
    for known in "${KNOWN_DUPES[@]}"; do
      if [[ "$prefix" == "$known" ]]; then
        known_dup=1
        break
      fi
    done
    if [[ "$known_dup" -eq 1 ]]; then
      echo "::warning::known duplicate migration prefix $prefix (grandfathered — renumber in maintenance window)"
      continue
    fi
    blocked=1
    echo "::error::duplicate migration timestamp prefix: $prefix"
    ls "$DIR"/"${prefix}"_*.sql 2>/dev/null | sed 's/^/    /'
  done <<< "$dupes"
  if [[ "$blocked" -ne 0 ]]; then
    exit 1
  fi
fi
echo "✅ migration timestamp prefixes are unique"
