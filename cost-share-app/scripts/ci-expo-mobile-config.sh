#!/usr/bin/env bash
# Catch app.config.ts / plugin errors before TestFlight (expo config --json).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/apps/mobile"

export EXPO_PUBLIC_KUPAPAY_PRO_ENABLED="${EXPO_PUBLIC_KUPAPAY_PRO_ENABLED:-true}"
export CI=1

echo "▶ expo config --json (EXPO_PUBLIC_KUPAPAY_PRO_ENABLED=$EXPO_PUBLIC_KUPAPAY_PRO_ENABLED)"
npx expo config --json >/dev/null
echo "✅ Expo config resolved successfully."
