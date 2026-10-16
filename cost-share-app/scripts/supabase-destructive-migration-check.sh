#!/usr/bin/env bash
# Blocks destructive SQL in new migration files unless explicitly annotated.
# Markers (line-level): -- destructive-ok: <reason>  OR  -- safe-breaking: <reason>
#
# Used in CI (migration-versions) and deploy-staging before db push.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
REPO_ROOT="$(git -C "$ROOT_DIR" rev-parse --show-toplevel)"

collect_new_migration_files() {
  local before="${1:-}"
  if [[ -n "$before" && "$before" != "0000000000000000000000000000000000000000" ]]; then
    git -C "$REPO_ROOT" diff "$before" HEAD \
      --diff-filter=A --name-only -- 'cost-share-app/supabase/migrations/*.sql' 2>/dev/null || true
    return
  fi
  # PR / local: all files added vs merge base
  local base="${GITHUB_BASE_REF:-dev}"
  local head="${PR_HEAD_SHA:-${GITHUB_SHA:-HEAD}}"
  git -C "$REPO_ROOT" diff --name-only --diff-filter=A "origin/${base}...${head}" \
    -- cost-share-app/supabase/migrations 2>/dev/null || true
}

BEFORE="${GITHUB_EVENT_BEFORE:-}"
mapfile -t NEW_FILES < <(collect_new_migration_files "$BEFORE")

if [[ ${#NEW_FILES[@]} -eq 0 ]]; then
  echo "✅ No new migrations — destructive SQL check skipped."
  exit 0
fi

CHECKS=(
  'TRUNCATE|TRUNCATE[[:space:]]+'
  'DROP_TABLE|DROP[[:space:]]+TABLE[[:space:]]+(IF[[:space:]]+EXISTS[[:space:]]+)?[^;]+;'
  'DROP_COLUMN|DROP[[:space:]]+COLUMN'
  'DROP_FUNCTION|DROP[[:space:]]+FUNCTION'
  'DROP_POLICY|DROP[[:space:]]+POLICY'
  'ALTER_COLUMN_TYPE|ALTER[[:space:]]+COLUMN[^;]*[[:space:]]TYPE'
)

FOUND=()
for rel in "${NEW_FILES[@]}"; do
  [[ -z "$rel" ]] && continue
  abs="$REPO_ROOT/$rel"
  [[ -f "$abs" ]] || continue
  name="$(basename "$abs")"
  filtered="$(grep -Ev 'destructive-ok:|safe-breaking:' "$abs" || true)"
  for entry in "${CHECKS[@]}"; do
    op="${entry%%|*}"
    pattern="${entry#*|}"
    if echo "$filtered" | grep -Eiq "$pattern"; then
      FOUND+=("$name → $op")
    fi
  done
done

if [[ ${#FOUND[@]} -gt 0 ]]; then
  cat <<'MSG'
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌  Destructive SQL blocked — add an explicit marker on the line
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MSG
  printf '  • %s\n' "${FOUND[@]}"
  cat <<'HINT'

Annotate reviewed destructive statements with either:
  -- destructive-ok: <why this is safe in dev/staging/prod>
  -- safe-breaking: <why old mobile clients tolerate this>

See docs/SSOT/ROLLBACK_RUNBOOK.md for rollback expectations.
HINT
  exit 1
fi

echo "✅ Destructive SQL check passed for ${#NEW_FILES[@]} new migration(s)."
