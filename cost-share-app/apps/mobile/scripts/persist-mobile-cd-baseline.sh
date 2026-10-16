#!/usr/bin/env bash
# Update MOBILE_CD_BASELINE after a successful staging build. Non-fatal on failure.
set -uo pipefail

platform="${1:-}"
sha="${2:-}"
release_notes_version="${3:-}"

if [[ "$platform" != "ios" && "$platform" != "android" ]]; then
  echo "::warning::persist-mobile-cd-baseline: platform must be ios or android"
  exit 0
fi

if [[ -z "$sha" ]]; then
  sha="${MOBILE_CD_SHA:-}"
fi
if [[ -z "$sha" ]]; then
  echo "::warning::persist-mobile-cd-baseline: missing commit SHA — skip"
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=mobile-cd-baseline-lib.sh
source "$SCRIPT_DIR/mobile-cd-baseline-lib.sh"

today="${JERUSALEM_DATE:-$(TZ=Asia/Jerusalem date +%Y-%m-%d)}"
current="$(load_baseline_json)"
updated="$(echo "$current" | jq -c \
  --arg sha "$sha" \
  --arg date "$today" \
  --arg ver "$release_notes_version" \
  --arg platform "$platform" \
  '.[$platform].lastSuccessfulSha = $sha
   | .[$platform].lastSuccessfulDateJerusalem = $date
   | if $ver != "" then .[$platform].lastReleaseNotesVersion = $ver else . end')"

if persist_baseline_json "$updated"; then
  echo "✅ Mobile CD baseline updated ($platform ${sha:0:7} on $today)"
  exit 0
fi

echo "::warning::Mobile CD baseline not persisted — workflow still succeeded; fix Actions variable permissions or ADMIN_PAT"
exit 0
