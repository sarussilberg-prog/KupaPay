#!/usr/bin/env bash
# Validates that Supabase migrations being deployed to production will not break
# mobile users who still have an older app version installed.
#
# Mobile apps keep old versions running indefinitely. A server-side migration
# that drops, renames, or incompatibly alters a column/table/function/policy
# will cause the old app to crash or lose data silently.
#
# Run automatically by CI before every production deploy (deploy-production.yml).
# Can also be run locally against the current branch:
#   bash cost-share-app/scripts/supabase-safe-migration-check.sh
#
# ── Escape hatch ─────────────────────────────────────────────────────────────
# If you have reviewed a specific statement and are certain it is safe for old
# app users, annotate that SQL line with:
#
#   DROP COLUMN old_col; -- safe-breaking: col removed from app since v2.3.0
#
# Lines with -- safe-breaking are excluded from all pattern checks.
#
# Exit 0 = safe to deploy | Exit 1 = blocked
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MIGRATIONS_DIR="supabase/migrations"
REPO_ROOT="$(git -C "$ROOT_DIR" rev-parse --show-toplevel)"

# ── Determine which migration files are new in this push ──────────────────────
# GITHUB_EVENT_BEFORE is set by the workflow for push events (the SHA before
# this push). Empty or all-zeros means workflow_dispatch or an initial commit —
# in those cases we cannot determine what is "new", so we skip the check.
BEFORE="${GITHUB_EVENT_BEFORE:-}"

if [[ -z "$BEFORE" || "$BEFORE" == "0000000000000000000000000000000000000000" ]]; then
  echo "ℹ️  Manual dispatch or initial push — backward-compat check skipped."
  echo "   To check specific files locally: inspect any .sql in $MIGRATIONS_DIR"
  exit 0
fi

NEW_FILES=()
while IFS= read -r rel; do
  [[ -z "$rel" ]] && continue
  abs="$REPO_ROOT/$rel"
  [[ -f "$abs" ]] && NEW_FILES+=("$abs")
done < <(
  git -C "$REPO_ROOT" diff "$BEFORE" HEAD \
    --diff-filter=A --name-only \
    -- '*/supabase/migrations/*.sql' 2>/dev/null
)

if [[ ${#NEW_FILES[@]} -eq 0 ]]; then
  echo "✅ No new migration files in this push — nothing to validate."
  exit 0
fi

echo "🔍 Checking ${#NEW_FILES[@]} new migration(s) for backward compatibility..."
echo ""

# ── Dangerous SQL patterns ────────────────────────────────────────────────────
# Format: "LABEL|egrep-regex"  (matched case-insensitively; uses grep -E)
#
# Why each pattern is dangerous for old mobile app users:
#   DROP_COLUMN       — old app still SELECTs / INSERTs that column → error
#   RENAME_COLUMN     — old app references old column name → error
#   DROP_TABLE        — old app queries the removed table → 42P01 error
#   DROP_FUNCTION     — old app calls the RPC → error
#   DROP_POLICY       — could remove row-level access the old app relies on
#   ALTER_COLUMN_TYPE — type mismatch between old app and new schema → cast error
#   REVOKE            — removes database permissions the old app depends on
CHECKS=(
  'DROP_COLUMN|DROP[[:space:]]+COLUMN'
  'RENAME_COLUMN|RENAME[[:space:]]+COLUMN'
  'DROP_TABLE|DROP[[:space:]]+TABLE'
  'DROP_FUNCTION|DROP[[:space:]]+FUNCTION'
  'DROP_POLICY|DROP[[:space:]]+POLICY'
  'ALTER_COLUMN_TYPE|ALTER[[:space:]]+COLUMN[^;]*[[:space:]]TYPE'
  'REVOKE|^[[:space:]]*REVOKE'
)

FOUND_ISSUES=()

for abs in "${NEW_FILES[@]}"; do
  name="$(basename "$abs")"
  echo "  ▸ $name"

  # Strip lines the developer has explicitly reviewed and annotated safe.
  filtered="$(grep -v 'safe-breaking' "$abs" || true)"

  for entry in "${CHECKS[@]}"; do
    op="${entry%%|*}"
    pattern="${entry#*|}"
    if echo "$filtered" | grep -Eiq "$pattern"; then
      FOUND_ISSUES+=("$name  →  $op")
      echo "    ⛔  $op"
    fi
  done
done

echo ""

if [[ ${#FOUND_ISSUES[@]} -gt 0 ]]; then
  cat << 'BANNER'
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌  DEPLOY BLOCKED — backward-incompatible migration detected
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BANNER
  echo ""
  printf '  • %s\n' "${FOUND_ISSUES[@]}"
  cat << 'GUIDE'

Mobile users keep old app versions installed. A server-side DB change
that removes or renames something the old app still touches will cause
that version to crash or lose data silently.

How to fix:
  1. Make it additive (preferred):
       • ADD a new column/function alongside the old one.
       • Ship the app update that removes the old reference.
       • Only then schedule the DROP in a later release.

  2. If you are certain this specific statement is safe (the old app
     never touches this column / table / function), add an annotation:
       DROP COLUMN old_col; -- safe-breaking: col removed from app in v2.0

GUIDE
  exit 1
fi

echo "✅ All ${#NEW_FILES[@]} migration(s) are backward-compatible — safe to deploy."
