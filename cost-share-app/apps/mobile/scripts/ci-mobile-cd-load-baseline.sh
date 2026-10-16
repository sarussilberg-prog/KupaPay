#!/usr/bin/env bash
# Export MOBILE_CD_BASELINE_JSON for ci-mobile-cd-plan.sh (stdout = compact JSON).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=mobile-cd-baseline-lib.sh
source "$SCRIPT_DIR/mobile-cd-baseline-lib.sh"

json="$(load_baseline_json)"
for platform in ios android; do
  sha="$(platform_field "$json" "$platform" lastSuccessfulSha)"
  if [[ -z "$sha" || "$sha" == "null" ]]; then
    fb="$(fallback_sha_from_runs "$platform")"
    if [[ -n "$fb" ]]; then
      json="$(echo "$json" | jq -c --arg fb "$fb" --arg p "$platform" '.[$p].lastSuccessfulSha = $fb')"
    fi
  fi
done
echo "$json"
