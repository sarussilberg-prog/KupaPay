#!/usr/bin/env bash
# Catch app.config.ts / plugin errors before TestFlight (expo config --json).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/apps/mobile"

export EXPO_PUBLIC_KUPAPAY_PRO_ENABLED="${EXPO_PUBLIC_KUPAPAY_PRO_ENABLED:-true}"
export CI=1

EXPO_BIN="$ROOT/node_modules/.bin/expo"
if [[ ! -x "$EXPO_BIN" ]]; then
  echo "::error::Missing $EXPO_BIN — run npm ci in cost-share-app first."
  exit 1
fi

echo "▶ expo config --json (EXPO_PUBLIC_KUPAPAY_PRO_ENABLED=$EXPO_PUBLIC_KUPAPAY_PRO_ENABLED)"
"$EXPO_BIN" config --json >/dev/null
echo "✅ Expo config resolved successfully."
