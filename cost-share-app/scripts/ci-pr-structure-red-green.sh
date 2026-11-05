#!/usr/bin/env bash
# Red/green proof: changed tests must FAIL on base + PASS on head (bug-fix PRs).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Diff lists paths from repo root (`cost-share-app/...`); git pathspecs here are under `apps/`.
git_path_from_diff() {
  local f="$1"
  if [[ "$f" == cost-share-app/* ]]; then
    echo "${f#cost-share-app/}"
  else
    echo "$f"
  fi
}

BASE_REF="${GITHUB_BASE_REF:-dev}"
HEAD_SHA="${PR_HEAD_SHA:-${GITHUB_SHA:-HEAD}}"
SUMMARY_FILE="${GITHUB_STEP_SUMMARY:-/dev/null}"

if [[ "${#@}" -eq 0 ]]; then
  echo "No test files for red/green proof — skipping."
  exit 0
fi

git fetch origin "$BASE_REF" --depth=1 2>/dev/null || true
MERGE_BASE="$(git merge-base "origin/${BASE_REF}" "$HEAD_SHA" 2>/dev/null || git merge-base "$BASE_REF" "$HEAD_SHA")"

run_jest_files() {
  local -a files=("$@")
  local rel=()
  for f in "${files[@]}"; do
    rel+=("${f#cost-share-app/apps/mobile/}")
  done
  npm test --workspace=@cost-share/mobile -- --ci --forceExit --passWithNoTests "${rel[@]}"
}

run_node_test_files() {
  local -a files=("$@")
  node --test "${files[@]}"
}

partition_and_run() {
  local expect_fail=$1
  shift
  local -a jest_files=()
  local -a node_files=()
  for f in "$@"; do
    case "$f" in
      cost-share-app/apps/mobile/*)
        jest_files+=("$f")
        ;;
      cost-share-app/scripts/*)
        if [[ "$f" == *.test.mjs ]]; then
          node_files+=("$f")
        else
          echo "::warning::Red/green skipped for unsupported test path: $f"
        fi
        ;;
      *)
        echo "::warning::Red/green skipped for unsupported test path: $f"
        ;;
    esac
  done

  local exit_code=0
  if [[ ${#jest_files[@]} -gt 0 ]]; then
    set +e
    run_jest_files "${jest_files[@]}"
    exit_code=$?
    set -e
  fi
  if [[ ${#node_files[@]} -gt 0 ]]; then
    set +e
    run_node_test_files "${node_files[@]}"
    local node_exit=$?
    set -e
    if [[ "$node_exit" -ne 0 ]]; then
      exit_code=$node_exit
    fi
  fi

  if [[ "$expect_fail" == "true" ]]; then
    if [[ "$exit_code" -eq 0 ]]; then
      echo "::error::Red/green proof failed: tests PASSED on base commit (expected FAIL)."
      return 1
    fi
    echo "✓ Tests failed on base as expected."
    return 0
  fi

  if [[ "$exit_code" -ne 0 ]]; then
    echo "::error::Red/green proof failed: tests FAILED on PR head (expected PASS)."
    return 1
  fi
  echo "✓ Tests passed on PR head."
  return 0
}

{
  echo "## Red/green regression proof"
  echo ""
  echo "- Merge base: \`${MERGE_BASE:0:12}\`"
  echo "- Head: \`${HEAD_SHA:0:12}\`"
  echo "- Test files: $(printf '\`%s\` ' "$@")"
  echo ""
} >>"$SUMMARY_FILE"

echo "▶ Red phase — base commit + PR test files only"
git stash push -u -m pr-structure-gate-stash --quiet 2>/dev/null || true
git checkout "$MERGE_BASE" --quiet

for f in "$@"; do
  git_path="$(git_path_from_diff "$f")"
  git checkout "$HEAD_SHA" -- "$git_path" 2>/dev/null || {
    echo "::error::Could not overlay test file from head: $f"
    git checkout "$HEAD_SHA" --quiet 2>/dev/null || true
    exit 1
  }
done

partition_and_run true "$@"
RED_OK=$?

git checkout "$HEAD_SHA" --quiet
git stash pop --quiet 2>/dev/null || true

echo "▶ Green phase — PR head"
partition_and_run false "$@"
GREEN_OK=$?

if [[ "$RED_OK" -ne 0 || "$GREEN_OK" -ne 0 ]]; then
  {
    echo ""
    echo "**Result:** ❌ Red/green proof failed."
  } >>"$SUMMARY_FILE"
  exit 1
fi

{
  echo ""
  echo "**Result:** ✅ Tests **fail** on base and **pass** on head."
} >>"$SUMMARY_FILE"

echo "✅ Red/green proof passed."
