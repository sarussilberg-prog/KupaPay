#!/usr/bin/env bash
# Decide whether nightly mobile CD should run iOS and/or Android (stdout: true|false per platform).
set -euo pipefail

MOBILE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$MOBILE_ROOT/../.." && pwd)"
BASELINE="$MOBILE_ROOT/mobile-cd-baseline.json"
WATCH=(
  cost-share-app/apps/mobile
  cost-share-app/packages/shared
  cost-share-app/package.json
  cost-share-app/package-lock.json
)

ENFORCE_DAILY_LIMIT="${ENFORCE_DAILY_LIMIT:-true}"
GIT_REF="${MOBILE_CD_GIT_REF:-dev}"

cd "$REPO_ROOT"
git fetch origin "$GIT_REF" --quiet
HEAD_SHA="$(git rev-parse "origin/${GIT_REF}")"
TODAY="$(TZ=Asia/Jerusalem date +%Y-%m-%d)"

should_run_platform() {
  local platform=$1
  local last_sha last_date
  last_sha="$(jq -r ".${platform}.lastSuccessfulSha // empty" "$BASELINE")"
  last_date="$(jq -r ".${platform}.lastSuccessfulDateJerusalem // empty" "$BASELINE")"

  if [[ "$ENFORCE_DAILY_LIMIT" == "true" && -n "$last_date" && "$last_date" == "$TODAY" ]]; then
    echo "::notice::Skip ${platform} — already built successfully on ${TODAY} (Asia/Jerusalem)"
    echo false
    return 0
  fi

  if [[ -z "$last_sha" || "$last_sha" == "null" ]]; then
    echo "::notice::Skip ${platform} — no prior successful build in mobile-cd-baseline.json (use manual TestFlight / Play workflow once)"
    echo false
    return 0
  fi

  if git diff --quiet "$last_sha" "$HEAD_SHA" -- "${WATCH[@]}"; then
    echo "::notice::Skip ${platform} — no mobile/shared changes since last successful build (${last_sha:0:7})"
    echo false
  else
    echo true
  fi
}

if [[ "${1:-}" == "ios" || "${1:-}" == "android" ]]; then
  should_run_platform "$1"
  exit 0
fi

echo "ios=$(should_run_platform ios)"
echo "android=$(should_run_platform android)"
