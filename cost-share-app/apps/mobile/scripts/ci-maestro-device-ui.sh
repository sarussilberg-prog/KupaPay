#!/usr/bin/env bash
# Build (or reuse) a dev client and run Maestro device UI flows on iOS simulator or Android emulator.
set -euo pipefail

PLATFORM="${1:?Usage: ci-maestro-device-ui.sh ios|android [build|test|all]}"
PHASE="${2:-${MAESTRO_PHASE:-all}}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/ios-simulator-devices.sh
source "$SCRIPT_DIR/lib/ios-simulator-devices.sh"
# shellcheck source=lib/maestro-ci-build.sh
source "$SCRIPT_DIR/lib/maestro-ci-build.sh"

ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/../../.." && pwd)"
COST_SHARE="$REPO_ROOT/cost-share-app"
ARTIFACTS="${MAESTRO_ARTIFACTS_DIR:-$REPO_ROOT/artifacts/maestro-device-ui}"
FLOW_PLAN_JSON="${MAESTRO_FLOW_PLAN_JSON:-}"

export EXPO_PUBLIC_E2E_MAESTRO_AUTH=true
export EXPO_PUBLIC_SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-${E2E_SUPABASE_URL:-}}"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-${E2E_SUPABASE_ANON_KEY:-}}"
export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-180000}"

if [[ -z "${E2E_TEST_PASSWORD:-}" ]]; then
  echo "::error::E2E_TEST_PASSWORD is required for Maestro device UI"
  exit 1
fi

export E2E_EMAIL="${E2E_TEST_EMAIL:-e2e-playwright@kupay-dev.test}"
export EXPO_PUBLIC_E2E_TEST_EMAIL="$E2E_EMAIL"

maestro_ensure_cli
maestro_write_mobile_e2e_env "$ROOT"
maestro_seed_e2e_if_configured "$COST_SHARE"

mkdir -p "$ARTIFACTS/screenshots"

if [[ "$PLATFORM" == "ios" ]]; then
  if [[ "$PHASE" == "build" || "$PHASE" == "all" ]]; then
    maestro_ios_prebuild_and_pods "$ROOT"
    parse_ios_simulator_devices
    local_first="${IOS_DEVICES[0]}"
    echo "=== iOS build simulator: $local_first ==="
    prepare_ios_simulator "$local_first"
    if [[ -n "${MAESTRO_IOS_APP_CACHE_DIR:-}" ]] && maestro_restore_ios_app_artifact "$MAESTRO_IOS_APP_CACHE_DIR"; then
      run_ios_on_simulator
    else
      run_ios_on_simulator
    fi
    if [[ -n "${MAESTRO_IOS_APP_STAGING_DIR:-}" ]]; then
      maestro_stage_ios_app_artifact "$MAESTRO_IOS_APP_STAGING_DIR"
    fi
  fi

  if [[ "$PHASE" == "test" || "$PHASE" == "all" ]]; then
    if [[ "$PHASE" == "test" ]]; then
      maestro_ios_prebuild_and_pods "$ROOT"
    fi
    if [[ -z "$FLOW_PLAN_JSON" && "$PHASE" == "test" ]]; then
      echo "::error::MAESTRO_FLOW_PLAN_JSON required for test phase"
      exit 1
    fi
    if [[ "$PHASE" == "all" && -z "$FLOW_PLAN_JSON" ]]; then
      FLOW_PLAN_JSON='[{"file":"sign-in.yaml","locales":null},{"file":"assert-layout-probes.yaml","locales":null},{"file":"locale-strings-login.yaml","locales":["en","he","ar","ru","de","es","fr"]},{"file":"main-layout.yaml","locales":["en","he"]},{"file":"profile-friend-breakdown.yaml","locales":["he"]}]'
    fi
    parse_ios_simulator_devices
    sim_for_test="${IOS_DEVICES[0]}"
    prepare_ios_simulator "$sim_for_test"
    if [[ -n "${MAESTRO_IOS_APP_CACHE_DIR:-}" ]]; then
      maestro_restore_ios_app_artifact "$MAESTRO_IOS_APP_CACHE_DIR" || true
    fi
    if [[ -z "${IOS_APP_BINARY:-}" ]]; then
      run_ios_on_simulator
    else
      npx expo run:ios --device "$IOS_SIM_UDID" --configuration Release --binary "$IOS_APP_BINARY" --no-bundler
    fi
    export MAESTRO_PLATFORM="ios-${IOS_SIM_NAME// /-}"
    if [[ "$PHASE" == "all" ]]; then
      for SIM in "${IOS_DEVICES[@]}"; do
        [[ "$SIM" == "$sim_for_test" ]] && continue
        echo "=== iOS extra simulator probes: $SIM ==="
        prepare_ios_simulator "$SIM"
        run_ios_on_simulator
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
      export MAESTRO_PLATFORM="ios-${IOS_SIM_NAME// /-}"
    fi
    maestro_run_flow_plan "$ROOT" "$FLOW_PLAN_JSON"
  fi
elif [[ "$PLATFORM" == "android" ]]; then
  cd "$ROOT"
  if [[ "$PHASE" == "build" || "$PHASE" == "all" ]]; then
    maestro_android_prebuild "$ROOT"
    maestro_android_assemble_release "$ROOT"
    if [[ -n "${MAESTRO_ANDROID_APK_STAGING_DIR:-}" ]]; then
      maestro_stage_android_apk "$ROOT" "$MAESTRO_ANDROID_APK_STAGING_DIR"
    fi
  fi
  if [[ "$PHASE" == "test" || "$PHASE" == "all" ]]; then
    if [[ "$PHASE" == "test" ]]; then
      maestro_android_prebuild "$ROOT"
    fi
    if [[ -z "$FLOW_PLAN_JSON" && "$PHASE" == "test" ]]; then
      echo "::error::MAESTRO_FLOW_PLAN_JSON required for test phase"
      exit 1
    fi
    if [[ "$PHASE" == "all" && -z "$FLOW_PLAN_JSON" ]]; then
      FLOW_PLAN_JSON='[{"file":"sign-in.yaml","locales":null},{"file":"assert-layout-probes.yaml","locales":null},{"file":"locale-strings-login.yaml","locales":["en","he","ar","ru","de","es","fr"]},{"file":"main-layout.yaml","locales":["en","he"]},{"file":"profile-friend-breakdown.yaml","locales":["he"]}]'
    fi
    if [[ "$PHASE" == "test" && -n "${MAESTRO_ANDROID_APK_CACHE_DIR:-}" && -f "$MAESTRO_ANDROID_APK_CACHE_DIR/app-release.apk" ]]; then
      adb install -r "$MAESTRO_ANDROID_APK_CACHE_DIR/app-release.apk" || true
    fi
    export MAESTRO_PLATFORM="android"
    maestro_run_flow_plan "$ROOT" "$FLOW_PLAN_JSON"
  fi
else
  echo "Unknown platform: $PLATFORM"
  exit 1
fi

maestro_collect_screenshots "$ARTIFACTS"
echo "Screenshots collected under $ARTIFACTS/screenshots"
