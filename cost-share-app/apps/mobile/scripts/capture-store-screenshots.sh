#!/usr/bin/env bash
# Regenerate iOS + Play store listing PNGs (Expo web export + Playwright).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export EXPO_PUBLIC_ASC_SCREENSHOT_DEMO="${EXPO_PUBLIC_ASC_SCREENSHOT_DEMO:-true}"
export EXPO_PUBLIC_KUPAPAY_PRO_ENABLED="${EXPO_PUBLIC_KUPAPAY_PRO_ENABLED:-true}"
export EXPO_PUBLIC_WEB_APP_URL="${EXPO_PUBLIC_WEB_APP_URL:-https://kupa-pay.com}"

export EXPO_PUBLIC_SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-https://drxfbicunusmipdgbgdk.supabase.co}"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyeGZiaWN1bnVzbWlwZGdiZ2RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDB9.capture-screenshot-anon-key}"

npx expo export --platform web
node scripts/playwright/capture-store-screenshots.mjs
