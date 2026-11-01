#!/usr/bin/env bash
# Validates PR template sections, test claims vs diff, spec touch, and optional red/green proof.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/.." && pwd)"
cd "$REPO_ROOT"

BASE_REF="${GITHUB_BASE_REF:-dev}"
PR_BODY="${PR_BODY:-}"
PR_TITLE="${PR_TITLE:-}"
PR_AUTHOR="${PR_AUTHOR:-}"
PR_LABELS="${PR_LABELS:-}"
PR_HEAD_SHA="${PR_HEAD_SHA:-${GITHUB_SHA:-HEAD}}"
SUMMARY_FILE="${GITHUB_STEP_SUMMARY:-/dev/null}"

if [[ -z "$PR_BODY" && -n "${PR_BODY_FILE:-}" ]]; then
  PR_BODY="$(cat "$PR_BODY_FILE")"
fi

git fetch origin "$BASE_REF" --depth=1 2>/dev/null || true
CHANGED_LIST="$(mktemp)"
git diff --name-only "origin/${BASE_REF}...${PR_HEAD_SHA}" 2>/dev/null >"$CHANGED_LIST" || true
if [[ ! -s "$CHANGED_LIST" ]]; then
  git diff --name-only "${BASE_REF}...${PR_HEAD_SHA}" >"$CHANGED_LIST" 2>/dev/null || true
fi

BODY_FILE="$(mktemp)"
printf '%s' "$PR_BODY" >"$BODY_FILE"

set +e
STRUCT_OUT="$(
  node "$ROOT/scripts/lib/pr-structure-gate.mjs" validate \
    --body-file "$BODY_FILE" \
    --title "$PR_TITLE" \
    --author "$PR_AUTHOR" \
    --labels "$PR_LABELS" \
    --diff-files "$CHANGED_LIST"
)"
STRUCT_EXIT=$?
set -e

echo "$STRUCT_OUT"

META_JSON="$(echo "$STRUCT_OUT" | tail -1)"
BUG_FIX="$(echo "$META_JSON" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{console.log(JSON.parse(s).meta?.bugFix?'true':'false')}catch{console.log('false')}})")"
CHANGED_TESTS="$(echo "$META_JSON" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const j=JSON.parse(s);console.log((j.meta?.changedTests||[]).join(' '))}catch{console.log('')}})")"

{
  echo "## PR structure gate"
  echo ""
  if [[ "$STRUCT_EXIT" -eq 0 ]]; then
    echo "✅ PR body and diff structure checks passed."
  else
    echo "❌ PR structure validation failed (see job log)."
  fi
  echo ""
} >>"$SUMMARY_FILE"

if [[ "$STRUCT_EXIT" -ne 0 ]]; then
  rm -f "$BODY_FILE" "$CHANGED_LIST"
  exit 1
fi

if [[ "$BUG_FIX" == "true" && -n "$CHANGED_TESTS" && "${RUN_RED_GREEN:-false}" == "true" ]]; then
  cd "$ROOT"
  # shellcheck disable=SC2086
  bash scripts/ci-pr-structure-red-green.sh $CHANGED_TESTS
fi

rm -f "$BODY_FILE" "$CHANGED_LIST"
