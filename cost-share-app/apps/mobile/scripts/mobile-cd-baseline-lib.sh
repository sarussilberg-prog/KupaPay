#!/usr/bin/env bash
# Read/write mobile CD baseline via repo Actions variable MOBILE_CD_BASELINE (no git push).
set -euo pipefail

MOBILE_CD_VAR_NAME="${MOBILE_CD_VAR_NAME:-MOBILE_CD_BASELINE}"
REPO="${GITHUB_REPOSITORY:-}"
GH_TOKEN="${ADMIN_PAT:-${GITHUB_TOKEN:-}}"

MOBILE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$MOBILE_ROOT/../.." && pwd)"
FALLBACK_FILE="$MOBILE_ROOT/mobile-cd-baseline.json"

default_json() {
  cat <<'JSON'
{"ios":{"lastSuccessfulSha":null,"lastSuccessfulDateJerusalem":null,"lastReleaseNotesVersion":null},"android":{"lastSuccessfulSha":null,"lastSuccessfulDateJerusalem":null,"lastReleaseNotesVersion":null}}
JSON
}

gh_api() {
  GH_TOKEN="$GH_TOKEN" gh api "$@"
}

fetch_variable_json() {
  if [[ -z "$REPO" || -z "$GH_TOKEN" ]]; then
    return 1
  fi
  gh_api "repos/${REPO}/actions/variables/${MOBILE_CD_VAR_NAME}" --jq .value 2>/dev/null
}

load_baseline_json() {
  if [[ -n "${MOBILE_CD_BASELINE_JSON:-}" ]]; then
    echo "$MOBILE_CD_BASELINE_JSON"
    return 0
  fi
  local from_var
  if from_var="$(fetch_variable_json)" && [[ -n "$from_var" ]]; then
    echo "$from_var"
    return 0
  fi
  if [[ -f "$FALLBACK_FILE" ]]; then
    jq -c '
      {
        ios: (.ios + {lastReleaseNotesVersion: (.ios.lastReleaseNotesVersion // null)}),
        android: (.android + {lastReleaseNotesVersion: (.android.lastReleaseNotesVersion // null)})
      }
    ' "$FALLBACK_FILE" 2>/dev/null || default_json
    return 0
  fi
  default_json
}

# Last successful workflow run head SHA (fallback when variable unset).
fallback_sha_from_runs() {
  local platform=$1
  local workflow
  case "$platform" in
    ios) workflow="testflight-ios.yml" ;;
    android) workflow="play-internal.yml" ;;
    *) return 1 ;;
  esac
  if [[ -z "$REPO" || -z "$GH_TOKEN" ]]; then
    return 1
  fi
  GH_TOKEN="$GH_TOKEN" gh run list \
    --repo "$REPO" \
    --workflow="$workflow" \
    --branch=dev \
    --status=success \
    --limit=1 \
    --json headSha \
    --jq '.[0].headSha // empty' 2>/dev/null || true
}

platform_field() {
  local json=$1
  local platform=$2
  local field=$3
  echo "$json" | jq -r ".${platform}.${field} // empty"
}

persist_baseline_json() {
  local json=$1
  if [[ -z "$REPO" || -z "$GH_TOKEN" ]]; then
    echo "::warning::Cannot persist MOBILE_CD_BASELINE — missing GITHUB_REPOSITORY or token"
    return 1
  fi
  if ! echo "$json" | jq empty 2>/dev/null; then
    echo "::warning::Invalid baseline JSON — not persisted"
    return 1
  fi
  local payload
  payload="$(jq -nc --arg name "$MOBILE_CD_VAR_NAME" --arg value "$json" '{name: $name, value: $value}')"
  if gh_api "repos/${REPO}/actions/variables/${MOBILE_CD_VAR_NAME}" >/dev/null 2>&1; then
    gh_api -X PATCH "repos/${REPO}/actions/variables/${MOBILE_CD_VAR_NAME}" --input - <<<"$payload" >/dev/null
  else
    gh_api -X POST "repos/${REPO}/actions/variables" --input - <<<"$payload" >/dev/null
  fi
  echo "Persisted ${MOBILE_CD_VAR_NAME} for ${REPO}"
}
