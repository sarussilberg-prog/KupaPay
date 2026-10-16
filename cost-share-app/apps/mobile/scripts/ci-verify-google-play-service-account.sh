#!/usr/bin/env bash
# Verify Play submit service account JSON (CI) — logs client_email only, never the key.
set -euo pipefail

EXPECTED_EMAIL="${PLAY_SUBMIT_SERVICE_ACCOUNT_EMAIL:-eas-play-submit@kupa-496716.iam.gserviceaccount.com}"

if [[ -z "${GOOGLE_PLAY_SERVICE_ACCOUNT_JSON:-}" ]]; then
  echo "::error::GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not set"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "::warning::jq not installed; skipping service account email verification"
  exit 0
fi

client_email="$(printf '%s' "$GOOGLE_PLAY_SERVICE_ACCOUNT_JSON" | jq -r .client_email)"
if [[ -z "$client_email" || "$client_email" == "null" ]]; then
  echo "::error::GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is missing client_email"
  exit 1
fi

echo "Play submit service account: $client_email"
if [[ "$client_email" != "$EXPECTED_EMAIL" ]]; then
  echo "::warning::Expected $EXPECTED_EMAIL — verify Play Console permissions for this account"
fi
