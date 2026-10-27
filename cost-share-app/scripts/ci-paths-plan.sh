#!/usr/bin/env bash
# Emit JSON flags for path-scoped CI (PRs to dev). PRs to main always run the full suite.
set -euo pipefail

BASE_REF="${GITHUB_BASE_REF:-dev}"
FULL=false
if [[ "$BASE_REF" == "main" ]]; then
  FULL=true
fi

emit_full() {
  jq -n \
    --argjson full true \
    '{
      full_suite: $full,
      monorepo: true,
      mobile: true,
      web: true,
      supabase: true,
      edge: true,
      docs: true,
      performance: true
    }'
  exit 0
}

if [[ "$FULL" == true ]]; then
  emit_full
fi

if [[ -z "${GITHUB_EVENT_NAME:-}" || "$GITHUB_EVENT_NAME" != "pull_request" ]]; then
  emit_full
fi

git fetch origin "$BASE_REF" --depth=1 2>/dev/null || true
changed="$(git diff --name-only "origin/${BASE_REF}"...HEAD 2>/dev/null || true)"

if [[ -z "$changed" ]]; then
  emit_full
fi

if echo "$changed" | grep -qE '^\.github/workflows/ci\.yml$|^\.github/workflows/ci-performance\.yml$|^cost-share-app/scripts/ci-paths-plan\.sh$'; then
  emit_full
fi

monorepo=false
mobile=false
web=false
supabase=false
edge=false
docs=false
performance=false

while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  case "$line" in
    cost-share-app/package.json|cost-share-app/package-lock.json|cost-share-app/turbo.json|cost-share-app/tsconfig*.json|.github/*)
      monorepo=true
      ;;
    cost-share-app/packages/shared/*)
      monorepo=true
      mobile=true
      web=true
      ;;
    cost-share-app/apps/mobile/*)
      mobile=true
      ;;
    cost-share-app/apps/web/*)
      web=true
      ;;
    cost-share-app/supabase/migrations/*|cost-share-app/supabase/__tests__/*|cost-share-app/supabase/config.toml|cost-share-app/supabase/schema.sql|cost-share-app/supabase/ci/*|cost-share-app/scripts/ci-supabase-*|cost-share-app/scripts/supabase-*)
      supabase=true
      ;;
    cost-share-app/supabase/functions/*|cost-share-app/scripts/ci-deno-*)
      edge=true
      ;;
    docs/*|*.md)
      docs=true
      ;;
  esac
done <<< "$changed"

if [[ "$monorepo" == true ]]; then
  mobile=true
  web=true
  supabase=true
  edge=true
  performance=true
else
  performance=false
  if [[ "$mobile" == true || "$web" == true ]]; then
    performance=true
  fi
fi

# Shared package changes fan out to app jobs
if echo "$changed" | grep -q '^cost-share-app/packages/shared/'; then
  mobile=true
  web=true
fi

only_docs=true
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  if [[ "$line" != docs/* && "$line" != *.md && "$line" != cost-share-app/docs/* ]]; then
    only_docs=false
    break
  fi
done <<< "$changed"

if [[ "$only_docs" == true && "$docs" == true ]]; then
  jq -n '{
    full_suite: false,
    monorepo: false,
    mobile: false,
    web: false,
    supabase: false,
    edge: false,
    docs: true,
    performance: false
  }'
  exit 0
fi

# Every PR to dev runs Supabase security SQL (RLS inventory + regression tests).
if [[ "$GITHUB_EVENT_NAME" == "pull_request" && "$BASE_REF" == "dev" ]]; then
  supabase=true
fi

jq -n \
  --argjson monorepo "$monorepo" \
  --argjson mobile "$mobile" \
  --argjson web "$web" \
  --argjson supabase "$supabase" \
  --argjson edge "$edge" \
  --argjson docs "$docs" \
  --argjson performance "$performance" \
  '{
    full_suite: false,
    monorepo: $monorepo,
    mobile: $mobile,
    web: $web,
    supabase: $supabase,
    edge: $edge,
    docs: $docs,
    performance: $performance
  }'
