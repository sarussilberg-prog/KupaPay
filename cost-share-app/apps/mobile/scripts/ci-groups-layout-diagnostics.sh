#!/usr/bin/env bash
# Collect native layout probe results via Maestro (iOS simulator and/or Android emulator).
set -euo pipefail

PLATFORM="${1:?Usage: ci-groups-layout-diagnostics.sh ios|android|both}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/../../.." && pwd)"
COST_SHARE="$REPO_ROOT/cost-share-app"
ARTIFACTS="${LAYOUT_DIAG_ARTIFACTS_DIR:-$REPO_ROOT/artifacts/groups-layout-diagnostics}"
LOCALES=(en he)

export EXPO_PUBLIC_E2E_MAESTRO_AUTH=true
export EXPO_PUBLIC_SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-${E2E_SUPABASE_URL:-}}"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-${E2E_SUPABASE_ANON_KEY:-}}"
export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-180000}"

if [[ -z "${E2E_TEST_PASSWORD:-}" ]]; then
  echo "::error::E2E_TEST_PASSWORD is required for layout diagnostics"
  exit 1
fi

export E2E_EMAIL="${E2E_TEST_EMAIL:-e2e-playwright@kupay-dev.test}"

if ! command -v maestro >/dev/null 2>&1; then
  curl -Ls "https://get.maestro.mobile.dev" | bash
  export PATH="$PATH:$HOME/.maestro/bin"
fi

cd "$COST_SHARE"
if [[ -n "${SUPABASE_URL:-}" && -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  npm run seed:e2e
fi

cd "$ROOT"
mkdir -p "$ARTIFACTS/json" "$ARTIFACTS/screenshots" "$ARTIFACTS/logs"

run_ios() {
  read -r -a IOS_DEVICES <<< "${IOS_SIMULATOR_DEVICES:-iPhone SE (3rd generation) iPhone 16 iPhone 16 Pro Max}"
  npx expo prebuild --platform ios --no-install
  (cd ios && pod install)
  for SIM in "${IOS_DEVICES[@]}"; do
    echo "=== Layout diagnostics iOS: $SIM ==="
    xcrun simctl boot "$SIM" 2>/dev/null || true
    npx expo run:ios --device "$SIM" --configuration Release
    export MAESTRO_PLATFORM="ios-${SIM// /-}"
    for loc in "${LOCALES[@]}"; do
      set +e
      maestro test \
        -e APP_LANG="$loc" \
        -e MAESTRO_PLATFORM="$MAESTRO_PLATFORM" \
        -e E2E_EMAIL="$E2E_EMAIL" \
        -e E2E_PASSWORD="$E2E_TEST_PASSWORD" \
        "$ROOT/.maestro/device-ui/groups-layout-diagnostics-tour.yaml" \
        2>&1 | tee "$ARTIFACTS/logs/${MAESTRO_PLATFORM}_${loc}.log"
      exit_code=$?
      set -e
      echo "$exit_code" > "$ARTIFACTS/logs/${MAESTRO_PLATFORM}_${loc}.exit"
    done
  done
}

run_android() {
  npx expo prebuild --platform android --no-install
  npx expo run:android --variant release
  export MAESTRO_PLATFORM="android"
  for loc in "${LOCALES[@]}"; do
    set +e
    maestro test \
      -e APP_LANG="$loc" \
      -e MAESTRO_PLATFORM="$MAESTRO_PLATFORM" \
      -e E2E_EMAIL="$E2E_EMAIL" \
      -e E2E_PASSWORD="$E2E_TEST_PASSWORD" \
      "$ROOT/.maestro/device-ui/groups-layout-diagnostics-tour.yaml" \
      2>&1 | tee "$ARTIFACTS/logs/${MAESTRO_PLATFORM}_${loc}.log"
    exit_code=$?
    set -e
    echo "$exit_code" > "$ARTIFACTS/logs/${MAESTRO_PLATFORM}_${loc}.exit"
  done
}

case "$PLATFORM" in
  ios) run_ios ;;
  android) run_android ;;
  both) run_ios; run_android ;;
  *) echo "Unknown platform: $PLATFORM"; exit 1 ;;
esac

LATEST="$(ls -td "$HOME/.maestro/tests"/* 2>/dev/null | head -1 || true)"
if [[ -n "${LATEST:-}" ]]; then
  find "$LATEST" -name '*.png' -exec cp {} "$ARTIFACTS/screenshots/" \;
fi

echo "Diagnostics artifacts: $ARTIFACTS"
