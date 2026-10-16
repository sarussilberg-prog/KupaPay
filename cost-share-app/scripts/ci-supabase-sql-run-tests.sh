#!/usr/bin/env bash
# Run SQL __tests__ against an already-bootstrapped Supabase Postgres container.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/ci-supabase-sql-lib.sh
source "$ROOT/scripts/ci-supabase-sql-lib.sh"

if ! postgres_container_running; then
  echo "::error::Postgres container ${PG_CONTAINER} is not running — run ci-supabase-sql-bootstrap.sh first"
  exit 1
fi

QUARANTINE_FILE="supabase/__tests__/ci-quarantine.json"
if [[ ! -f "$QUARANTINE_FILE" ]]; then
  echo "::error::missing $QUARANTINE_FILE"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "::error::jq required to read quarantine manifest"
  exit 1
fi

mapfile -t QUARANTINED < <(jq -r 'keys[] | select(startswith("_") | not)' "$QUARANTINE_FILE" | sort)
for q in "${QUARANTINED[@]}"; do
  if [[ ! -f "supabase/__tests__/$q" ]]; then
    echo "::error::quarantine entry missing file: $q"
    exit 1
  fi
done

files=(supabase/__tests__/*.test.sql)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "::error::no SQL tests found"
  exit 1
fi

ran=0
skipped=0
echo "▶ Running SQL tests (transaction rollback)"
for f in "${files[@]}"; do
  base="$(basename "$f")"
  issue="$(jq -r --arg f "$base" '.[$f].issue // empty' "$QUARANTINE_FILE")"
  if [[ -n "$issue" ]]; then
    reason="$(jq -r --arg f "$base" '.[$f].reason // "quarantined"' "$QUARANTINE_FILE")"
    echo "▶ skip — ${base} (quarantine #${issue}: ${reason})"
    skipped=$((skipped + 1))
    continue
  fi
  echo "▶ psql — ${base}"
  psql_docker_file "$f"
  ran=$((ran + 1))
done

for q in "${QUARANTINED[@]}"; do
  found=0
  for f in "${files[@]}"; do
    if [[ "$(basename "$f")" == "$q" ]]; then
      found=1
      break
    fi
  done
  if [[ "$found" -ne 1 ]]; then
    echo "::error::quarantine lists unknown test: $q"
    exit 1
  fi
done

echo "✅ SQL integration tests passed (${ran} ran, ${skipped} quarantined, ${#files[@]} total)"
