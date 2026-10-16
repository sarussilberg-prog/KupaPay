#!/usr/bin/env bash
# Label PR scope from changed paths and enforce conventional titles for cursor/* bot PRs.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

PR_NUMBER="${PR_NUMBER:-${GITHUB_EVENT_PULL_REQUEST_NUMBER:-}}"
PR_TITLE="${PR_TITLE:-${GITHUB_EVENT_PULL_REQUEST_TITLE:-}}"
HEAD_REF="${HEAD_REF:-${GITHUB_HEAD_REF:-}}"

if [[ -z "$PR_NUMBER" ]]; then
  echo "ℹ️  PR hygiene skipped (no PR number)"
  exit 0
fi

BASE_REF="${GITHUB_BASE_REF:-dev}"
git fetch origin "$BASE_REF" --depth=1 2>/dev/null || true
changed="$(git diff --name-only "origin/${BASE_REF}"...HEAD 2>/dev/null || true)"

declare -a LABELS=()
add_label() {
  local l=$1
  LABELS+=("$l")
}

while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  case "$line" in
    cost-share-app/apps/mobile/*|cost-share-app/packages/shared/*)
      add_label "scope:mobile"
      ;;
    cost-share-app/apps/web/*)
      add_label "scope:web"
      ;;
    cost-share-app/supabase/migrations/*|cost-share-app/supabase/__tests__/*|cost-share-app/supabase/schema.sql|cost-share-app/supabase/ci/*)
      add_label "scope:supabase"
      ;;
    cost-share-app/supabase/functions/*)
      add_label "scope:edge"
      ;;
    .github/*|cost-share-app/scripts/ci-*|cost-share-app/scripts/supabase-*)
      add_label "scope:ci"
      ;;
    docs/*|*.md)
      add_label "scope:docs"
      ;;
  esac
done <<< "$changed"

if [[ ${#LABELS[@]} -eq 0 ]]; then
  add_label "scope:other"
fi

mapfile -t UNIQUE_LABELS < <(printf '%s\n' "${LABELS[@]}" | sort -u)
echo "Scope labels: ${UNIQUE_LABELS[*]}"

if [[ -n "${GH_TOKEN:-}" ]]; then
  for label in "${UNIQUE_LABELS[@]}"; do
    gh label create "$label" --color "0E8A16" --force --repo "$GITHUB_REPOSITORY" 2>/dev/null || true
    gh pr edit "$PR_NUMBER" --repo "$GITHUB_REPOSITORY" --add-label "$label" 2>/dev/null || true
  done
fi

if [[ "$HEAD_REF" == cursor/* ]]; then
  if [[ ! "$PR_TITLE" =~ ^(feat|fix|ci|chore|docs|test|refactor|perf)(\([a-z0-9._/-]+\))?!?:\ .+ ]]; then
    echo "::error::Bot PR title must follow Conventional Commits: type(scope): description"
    echo "  Got: $PR_TITLE"
    exit 1
  fi
fi

echo "✅ PR hygiene passed"
