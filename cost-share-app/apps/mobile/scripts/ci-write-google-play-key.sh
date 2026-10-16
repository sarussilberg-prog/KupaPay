#!/usr/bin/env bash
# Write Google Play service account JSON from env (CI) for eas submit.
set -euo pipefail

out="$(cd "$(dirname "$0")/.." && pwd)/google-play-service-account.json"
if [[ -z "${GOOGLE_PLAY_SERVICE_ACCOUNT_JSON:-}" ]]; then
  echo "::error::GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not set (Play Console service account JSON)"
  exit 1
fi
printf '%s' "$GOOGLE_PLAY_SERVICE_ACCOUNT_JSON" > "$out"
chmod 600 "$out"
echo "Wrote Google Play service account to $out"
