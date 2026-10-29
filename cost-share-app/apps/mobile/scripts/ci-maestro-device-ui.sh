#!/usr/bin/env bash
# Build (or reuse) a dev client and run Maestro device UI flows on iOS simulator or Android emulator.
set -euo pipefail

PLATFORM="${1:?Usage: ci-maestro-device-ui.sh ios|android}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/../../.." && pwd)"
COST_SHARE="$REPO_ROOT/cost-share-app"
ARTIFACTS="${MAESTRO_ARTIFACTS_DIR:-$REPO_ROOT/artifacts/maestro-device-ui}"
LOCALES_LAYOUT=(en he)
LOCALES_ALL=(en he ar ru de es fr)

export EXPO_PUBLIC_E2E_MAESTRO_AUTH=true
export EXPO_PUBLIC_SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-${E2E_SUPABASE_URL:-}}"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-${E2E_SUPABASE_ANON_KEY:-}}"
export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-180000}"

if [[ -z "${E2E_TEST_PASSWORD:-}" ]]; then
  echo "::error::E2E_TEST_PASSWORD is required for Maestro device UI"
  exit 1
fi

export E2E_EMAIL="${E2E_TEST_EMAIL:-e2e-playwright@kupay-dev.test}"

if ! command -v maestro >/dev/null 2>&1; then
  echo "Installing Maestro CLI…"
  curl -Ls "https://get.maestro.mobile.dev" | bash
  export PATH="$PATH:$HOME/.maestro/bin"
fi

cd "$COST_SHARE"
if [[ -n "${SUPABASE_URL:-}" && -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  npm run seed:e2e
else
  echo "::notice::Skipping seed:e2e — Supabase service-role secrets not set"
fi

cd "$ROOT"
export EXPO_PUBLIC_E2E_TEST_EMAIL="$E2E_EMAIL"

mkdir -p "$ARTIFACTS/screenshots"

if [[ "$PLATFORM" == "ios" ]]; then
  read -r -a IOS_DEVICES <<< "${IOS_SIMULATOR_DEVICES:-iPhone SE (3rd generation) iPhone 16 iPhone 16 Pro Max}"
  npx expo prebuild --platform ios --no-install
  (cd ios && pod install)
  for SIM in "${IOS_DEVICES[@]}"; do
    echo "=== iOS simulator: $SIM ==="
    xcrun simctl boot "$SIM" 2>/dev/null || true
    npx expo run:ios --device "$SIM" --configuration Release
    export MAESTRO_PLATFORM="ios-${SIM// /-}"
    maestro test \
      -e APP_LANG=en \
      -e MAESTRO_PLATFORM="$MAESTRO_PLATFORM" \
      -e E2E_EMAIL="$E2E_EMAIL" \
      -e E2E_PASSWORD="$E2E_TEST_PASSWORD" \
      "$ROOT/.maestro/device-ui/sign-in.yaml"
    maestro test \
      -e APP_LANG=en \
      -e MAESTRO_PLATFORM="$MAESTRO_PLATFORM" \
      -e E2E_EMAIL="$E2E_EMAIL" \
      -e E2E_PASSWORD="$E2E_TEST_PASSWORD" \
      "$ROOT/.maestro/device-ui/assert-layout-probes.yaml"
  done
elif [[ "$PLATFORM" == "android" ]]; then
  npx expo prebuild --platform android --no-install
  npx expo run:android --variant release
else
  echo "Unknown platform: $PLATFORM"
  exit 1
fi

export MAESTRO_PLATFORM="$PLATFORM"

for loc in "${LOCALES_ALL[@]}"; do
  echo "Maestro locale strings (login): $loc"
  maestro test \
    -e APP_LANG="$loc" \
    -e MAESTRO_PLATFORM="$MAESTRO_PLATFORM" \
    "$ROOT/.maestro/device-ui/locale-strings-login.yaml"
done

for loc in "${LOCALES_LAYOUT[@]}"; do
  echo "Maestro layout tour: $loc"
  maestro test \
    -e APP_LANG="$loc" \
    -e MAESTRO_PLATFORM="$MAESTRO_PLATFORM" \
    -e E2E_EMAIL="$E2E_EMAIL" \
    -e E2E_PASSWORD="$E2E_TEST_PASSWORD" \
    "$ROOT/.maestro/device-ui/main-layout.yaml"
  if [[ "$loc" == "he" ]]; then
    echo "Maestro profile friend breakdown (RTL): $loc"
    maestro test \
      -e APP_LANG="$loc" \
      -e MAESTRO_PLATFORM="$MAESTRO_PLATFORM" \
      "$ROOT/.maestro/device-ui/profile-friend-breakdown.yaml"
  fi
done

LATEST="$(ls -td "$HOME/.maestro/tests"/* 2>/dev/null | head -1 || true)"
if [[ -n "${LATEST:-}" ]]; then
  find "$LATEST" -name '*.png' -exec cp {} "$ARTIFACTS/screenshots/" \;
fi

echo "Screenshots collected under $ARTIFACTS/screenshots"
