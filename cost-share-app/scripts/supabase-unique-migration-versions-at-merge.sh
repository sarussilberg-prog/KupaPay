#!/usr/bin/env bash
# Guard against migration version collisions that only appear after merging latest dev/main
# (two PRs branched from the same point and picked the same timestamp prefix).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/.."
REPO_ROOT="$PWD"

BASE_REF="${GITHUB_BASE_REF:-dev}"
PR_HEAD="${PR_HEAD_SHA:-${GITHUB_SHA:-HEAD}}"

echo "▶ Migration merge guard (base=origin/${BASE_REF}, head=${PR_HEAD})"
git fetch origin dev main "${BASE_REF}" --quiet

prefixes_on_ref() {
  local ref=$1
  git ls-tree --name-only "$ref" -- cost-share-app/supabase/migrations 2>/dev/null \
    | while read -r path; do
        [[ "$path" == *.sql ]] || continue
        basename "$path" | cut -d_ -f1
      done
}

declare -A DEV_PREFIXES=()
declare -A MAIN_PREFIXES=()
while IFS= read -r p; do
  [[ -z "$p" ]] && continue
  DEV_PREFIXES["$p"]=1
done < <(prefixes_on_ref "origin/dev")
while IFS= read -r p; do
  [[ -z "$p" ]] && continue
  MAIN_PREFIXES["$p"]=1
done < <(prefixes_on_ref "origin/main")

mapfile -t NEW_FILES < <(
  git diff --name-only --diff-filter=A "origin/${BASE_REF}...${PR_HEAD}" -- cost-share-app/supabase/migrations 2>/dev/null || true
)

collision=0
for path in "${NEW_FILES[@]}"; do
  [[ -z "$path" ]] && continue
  base="$(basename "$path")"
  if [[ ! "$base" =~ ^([0-9]{14})_ ]]; then
    echo "::error::New migration has invalid name: $base"
    collision=1
    continue
  fi
  ver="${BASH_REMATCH[1]}"
  if [[ -n "${DEV_PREFIXES[$ver]:-}" ]]; then
    echo "::error::Migration prefix $ver in $base already exists on latest origin/dev"
    collision=1
  fi
  if [[ -n "${MAIN_PREFIXES[$ver]:-}" ]]; then
    echo "::error::Migration prefix $ver in $base already exists on latest origin/main"
    collision=1
  fi
done

if [[ "$collision" -ne 0 ]]; then
  echo ""
  echo "Rebase onto latest origin/${BASE_REF} and pick a new timestamp prefix (see docs/SSOT/SUPABASE_MIGRATION_VERSIONS.md)."
  exit 1
fi

WORKTREE=""
cleanup() {
  if [[ -n "$WORKTREE" && -d "$WORKTREE" ]]; then
    git worktree remove -f "$WORKTREE" 2>/dev/null || true
    rm -rf "$WORKTREE"
  fi
}
trap cleanup EXIT

WORKTREE="$(mktemp -d "${TMPDIR:-/tmp}/kupapay-migrate-merge.XXXXXX")"
git worktree add -f "$WORKTREE" "origin/${BASE_REF}" >/dev/null

(
  cd "$WORKTREE"
  git config user.email "github-actions[bot]@users.noreply.github.com"
  git config user.name "github-actions[bot]"
  git merge --no-edit "$PR_HEAD" >/dev/null
)
MERGED_MIGRATIONS="$WORKTREE/cost-share-app/supabase/migrations"
export MIGRATIONS_DIR="$MERGED_MIGRATIONS"
bash "$REPO_ROOT/cost-share-app/scripts/supabase-lint-migration-filenames.sh"
bash "$REPO_ROOT/cost-share-app/scripts/supabase-unique-migration-versions.sh"

echo "✅ Migration merge simulation passed (unique against latest origin/${BASE_REF} + cross-check dev/main)."
