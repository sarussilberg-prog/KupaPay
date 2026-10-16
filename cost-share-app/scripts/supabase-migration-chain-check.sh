#!/usr/bin/env bash
# Migration chain: unique (delegated), strictly ordered prefixes, new files newer than base branch max.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$ROOT_DIR/supabase/migrations}"
BASE_REF="${GITHUB_BASE_REF:-dev}"
PR_HEAD="${PR_HEAD_SHA:-${GITHUB_SHA:-HEAD}}"

bash "$ROOT_DIR/scripts/supabase-unique-migration-versions.sh"

shopt -s nullglob
files=("$MIGRATIONS_DIR"/*.sql)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "::error::No migration files under supabase/migrations"
  exit 1
fi

prev=""
for f in "${files[@]}"; do
  base="$(basename "$f")"
  if [[ ! "$base" =~ ^([0-9]{14})_ ]]; then
    continue
  fi
  ver="${BASH_REMATCH[1]}"
  if [[ -n "$prev" && "$ver" <= "$prev" ]]; then
    echo "::error::Migration chain order broken: $base (prefix $ver) is not newer than $prev"
    echo "  Rename with a strictly increasing 14-digit timestamp (see docs/SSOT/SUPABASE_MIGRATION_VERSIONS.md)."
    exit 1
  fi
  prev="$ver"
done

REPO_ROOT="$(git -C "$ROOT_DIR" rev-parse --show-toplevel)"
cd "$REPO_ROOT"
git fetch origin "$BASE_REF" --quiet 2>/dev/null || true

max_on_base=""
while IFS= read -r p; do
  [[ -z "$p" ]] && continue
  if [[ -z "$max_on_base" || "$p" > "$max_on_base" ]]; then
    max_on_base="$p"
  fi
done < <(
  git ls-tree --name-only "origin/${BASE_REF}" -- cost-share-app/supabase/migrations 2>/dev/null \
    | while read -r path; do
        [[ "$path" == *.sql ]] || continue
        basename "$path" | cut -d_ -f1
      done
)

mapfile -t NEW_FILES < <(
  git diff --name-only --diff-filter=A "origin/${BASE_REF}...${PR_HEAD}" \
    -- cost-share-app/supabase/migrations 2>/dev/null || true
)

if [[ ${#NEW_FILES[@]} -eq 0 ]]; then
  echo "✅ Migration chain OK (${#files[@]} files, ordered; no new migrations vs origin/${BASE_REF})."
  exit 0
fi

if [[ -z "$max_on_base" ]]; then
  echo "✅ Migration chain OK (no migrations on origin/${BASE_REF} yet)."
  exit 0
fi

failed=0
for path in "${NEW_FILES[@]}"; do
  [[ -z "$path" ]] && continue
  base="$(basename "$path")"
  if [[ ! "$base" =~ ^([0-9]{14})_ ]]; then
    echo "::error::New migration has invalid name: $base"
    failed=1
    continue
  fi
  ver="${BASH_REMATCH[1]}"
  if [[ "$ver" <= "$max_on_base" ]]; then
    echo "::error::New migration $base prefix $ver must be newer than origin/${BASE_REF} max ($max_on_base)"
    failed=1
  fi
done

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi

echo "✅ Migration chain OK (${#NEW_FILES[@]} new migration(s) newer than origin/${BASE_REF} max $max_on_base)."
