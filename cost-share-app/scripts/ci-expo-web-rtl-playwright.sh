#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE="$ROOT/apps/mobile"
PORT="${E2E_EXPO_WEB_PORT:-8081}"
DIST="$MOBILE/dist"

cd "$MOBILE"
npx expo export --platform web --output-dir dist

node "$MOBILE/scripts/playwright/run-rtl-playwright.mjs" "$DIST" "$PORT"
