#!/usr/bin/env bash
# Regenerate iOS + Play store listing PNGs (Expo web export + Playwright).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export EXPO_PUBLIC_ASC_SCREENSHOT_DEMO="${EXPO_PUBLIC_ASC_SCREENSHOT_DEMO:-true}"
export EXPO_PUBLIC_KUPAPAY_PRO_ENABLED="${EXPO_PUBLIC_KUPAPAY_PRO_ENABLED:-true}"
export EXPO_PUBLIC_WEB_APP_URL="${EXPO_PUBLIC_WEB_APP_URL:-https://kupa-pay.com}"

if [[ -z "${EXPO_PUBLIC_SUPABASE_URL:-}" || -z "${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}" ]]; then
  echo "Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (dev project drxfbicunusmipdgbgdk)." >&2
  exit 1
fi

npx expo export --platform web
node scripts/playwright/capture-store-screenshots.mjs
