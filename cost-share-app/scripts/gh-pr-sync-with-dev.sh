#!/usr/bin/env bash
# Sync a PR branch with latest origin/dev via GitHub's update-branch API (merge commit).
# Prints defer_merge=true|false for CI auto-merge (defer when an update was queued).
set -euo pipefail

PR_NUMBER="${1:?PR number required}"
REPO="${2:?repo owner/name required}"
PR_HEAD_SHA="${3:?PR head SHA required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/gh-pr-sync-helpers.sh
source "${SCRIPT_DIR}/lib/gh-pr-sync-helpers.sh"

git fetch origin dev --quiet

head_sha="$(resolve_pr_head_sha_with_retry "$PR_NUMBER" "$REPO")"
if [[ -z "$head_sha" ]]; then
  echo "::error::Could not resolve PR head SHA after retries (event head: ${PR_HEAD_SHA})"
  exit 1
fi

behind="$(git rev-list --count "${head_sha}"..origin/dev)"
if [[ "$behind" -eq 0 ]]; then
  echo "✅ PR head includes latest origin/dev"
  echo "defer_merge=false"
  exit 0
fi

echo "▶ PR is ${behind} commit(s) behind origin/dev — calling gh pr update-branch"
set +e
gh_pr_update_branch_with_retry "$PR_NUMBER" "$REPO"
update_rc=$?
set -e
case "$update_rc" in
  0) ;;
  2)
    echo "::warning::update-branch still hitting head-ref flake after retries; deferring auto-merge for a fresh CI run"
    echo "defer_merge=true"
    exit 0
    ;;
  *)
    echo "::error::update-branch failed (merge conflicts?). Resolve on the PR branch and re-run CI."
    exit 1
    ;;
esac

echo "::notice::Branch update queued; GitHub will re-run required checks on the new merge commit."
echo "defer_merge=true"
