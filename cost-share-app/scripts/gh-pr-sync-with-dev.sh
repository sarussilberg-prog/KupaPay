#!/usr/bin/env bash
# Sync a PR branch with latest origin/dev via GitHub's update-branch API (merge commit).
# Prints defer_merge=true|false for CI auto-merge (defer when an update was queued).
set -euo pipefail

PR_NUMBER="${1:?PR number required}"
REPO="${2:?repo owner/name required}"
PR_HEAD_SHA="${3:?PR head SHA required}"

git fetch origin dev --quiet
behind="$(git rev-list --count "${PR_HEAD_SHA}"..origin/dev)"
if [[ "$behind" -eq 0 ]]; then
  echo "✅ PR head includes latest origin/dev"
  echo "defer_merge=false"
  exit 0
fi

echo "▶ PR is ${behind} commit(s) behind origin/dev — calling gh pr update-branch"
if ! gh pr update-branch "$PR_NUMBER" --repo "$REPO"; then
  echo "::error::update-branch failed (merge conflicts?). Resolve on the PR branch and re-run CI."
  exit 1
fi

echo "::notice::Branch update queued; GitHub will re-run required checks on the new merge commit."
echo "defer_merge=true"
