#!/usr/bin/env bash
# Emit a JSON array of edge function names for the Deno CI matrix (path-filtered on PRs).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FUNCTIONS_DIR="$ROOT/supabase/functions"

mapfile -t ALL_FUNCTIONS < <(
  for dir in "$FUNCTIONS_DIR"/*/; do
    [[ -f "${dir}index.ts" ]] || continue
    basename "$dir"
  done | sort
)

emit_all() {
  printf '%s\n' "${ALL_FUNCTIONS[@]}" | jq -R . | jq -s .
}

if [[ ${#ALL_FUNCTIONS[@]} -eq 0 ]]; then
  echo '[]'
  exit 0
fi

BASE_REF="${GITHUB_BASE_REF:-${BASE_REF:-dev}}"

if [[ "$BASE_REF" == "main" || "${DENO_MATRIX_RUN_ALL:-}" == "true" ]]; then
  emit_all
  exit 0
fi

if [[ -z "${GITHUB_EVENT_NAME:-}" || "$GITHUB_EVENT_NAME" != "pull_request" ]]; then
  emit_all
  exit 0
fi

git fetch origin "$BASE_REF" --depth=50 2>/dev/null || true
changed="$(git diff --name-only "origin/${BASE_REF}"...HEAD 2>/dev/null || true)"

if [[ -z "$changed" ]]; then
  emit_all
  exit 0
fi

if echo "$changed" | grep -qE '^\.github/workflows/ci\.yml$|^cost-share-app/scripts/ci-deno-'; then
  emit_all
  exit 0
fi

selected=()
for fn in "${ALL_FUNCTIONS[@]}"; do
  if echo "$changed" | grep -q "cost-share-app/supabase/functions/${fn}/"; then
    selected+=("$fn")
  fi
done

if [[ ${#selected[@]} -eq 0 ]]; then
  echo '[]'
  exit 0
fi

printf '%s\n' "${selected[@]}" | jq -R . | jq -s .
