#!/usr/bin/env bash
# Collect native layout probe results via Maestro (iOS simulator and/or Android emulator).
set -euo pipefail

PLATFORM="${1:?Usage: ci-groups-layout-diagnostics.sh ios|android|both [build|test|all]}"
PHASE="${2:-${MAESTRO_PHASE:-all}}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/ios-simulator-devices.sh
source "$SCRIPT_DIR/lib/ios-simulator-devices.sh"
# shellcheck source=lib/maestro-ci-build.sh
source "$SCRIPT_DIR/lib/maestro-ci-build.sh"

ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/../../.." && pwd)"
COST_SHARE="$REPO_ROOT/cost-share-app"
ARTIFACTS="${LAYOUT_DIAG_ARTIFACTS_DIR:-$REPO_ROOT/artifacts/groups-layout-diagnostics}"
TOUR_FLOW="$ROOT/.maestro/device-ui/groups-layout-diagnostics-tour.yaml"
LOCALES=(en he)
LAYOUT_DIAG_FAILURES=0

export EXPO_PUBLIC_E2E_MAESTRO_AUTH=true
export EXPO_PUBLIC_SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-${E2E_SUPABASE_URL:-}}"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-${E2E_SUPABASE_ANON_KEY:-}}"
export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-180000}"

if [[ ! -f "$TOUR_FLOW" ]]; then
  echo "::notice::Skipping groups layout diagnostics — $TOUR_FLOW not present (enable with Phase 1 diagnostics PR)"
  exit 0
fi

if [[ -z "${E2E_TEST_PASSWORD:-}" ]]; then
  echo "::error::E2E_TEST_PASSWORD is required for layout diagnostics"
  exit 1
fi

export E2E_EMAIL="${E2E_TEST_EMAIL:-e2e-playwright@kupay-dev.test}"
export EXPO_PUBLIC_E2E_TEST_EMAIL="$E2E_EMAIL"

maestro_ensure_cli
maestro_seed_e2e_if_configured "$COST_SHARE"
mkdir -p "$ARTIFACTS/json" "$ARTIFACTS/screenshots" "$ARTIFACTS/logs" "$ARTIFACTS/debug"

layout_diag_record_failure() {
  LAYOUT_DIAG_FAILURES=$((LAYOUT_DIAG_FAILURES + 1))
}

layout_diag_assert_json_nonempty() {
  local json_path="$1"
  local label="$2"
  if [[ ! -s "$json_path" ]]; then
    echo "::error::Missing or empty layout diagnostics JSON for $label ($json_path)"
    layout_diag_record_failure
    return 1
  fi
  return 0
}

run_diag_flows() {
  local maestro_platform="$1"
  local loc
  for loc in "${LOCALES[@]}"; do
    set +e
    maestro test \
      -e APP_LANG="$loc" \
      -e MAESTRO_PLATFORM="$maestro_platform" \
      -e E2E_EMAIL="$E2E_EMAIL" \
      -e E2E_PASSWORD="$E2E_TEST_PASSWORD" \
      "$TOUR_FLOW" \
      2>&1 | tee "$ARTIFACTS/logs/${maestro_platform}_${loc}.log"
    exit_code=$?
    set -e
    echo "$exit_code" > "$ARTIFACTS/logs/${maestro_platform}_${loc}.exit"
    grep -o '\[LAYOUT_DIAG_JSON\].*' "$ARTIFACTS/logs/${maestro_platform}_${loc}.log" \
      | sed 's/^\[LAYOUT_DIAG_JSON\] //' \
      > "$ARTIFACTS/json/${maestro_platform}_${loc}.json" 2>/dev/null || true

    if [[ "$exit_code" -ne 0 ]]; then
      echo "::error::Maestro layout diagnostics failed for $maestro_platform / $loc (exit $exit_code)"
      layout_diag_record_failure
      maestro_collect_maestro_failure_debug "$ARTIFACTS" "${maestro_platform}_${loc}"
      maestro_collect_ios_simulator_logs "$ARTIFACTS" "${maestro_platform}_${loc}"
    fi
    layout_diag_assert_json_nonempty "$ARTIFACTS/json/${maestro_platform}_${loc}.json" "${maestro_platform}_${loc}" || true
  done
}

run_ios() {
  if [[ "$PHASE" == "build" || "$PHASE" == "all" ]]; then
    maestro_ios_prebuild_and_pods "$ROOT"
    parse_ios_simulator_devices
    prepare_ios_simulator "${IOS_DEVICES[0]}"
    if [[ -n "${MAESTRO_IOS_APP_CACHE_DIR:-}" ]] && maestro_restore_ios_app_artifact "$MAESTRO_IOS_APP_CACHE_DIR"; then
      run_ios_on_simulator
    else
      run_ios_on_simulator
    fi
    if [[ -n "${MAESTRO_IOS_APP_STAGING_DIR:-}" ]]; then
      maestro_stage_ios_app_artifact "$MAESTRO_IOS_APP_STAGING_DIR"
      maestro_audit_ios_app_e2e_bake "$MAESTRO_IOS_APP_STAGING_DIR/KupaPay.app" "$ARTIFACTS/app-env-audit.txt" || true
    fi
  fi
  if [[ "$PHASE" == "test" || "$PHASE" == "all" ]]; then
    parse_ios_simulator_devices
    for SIM in "${IOS_DEVICES[@]}"; do
      echo "=== Layout diagnostics iOS: $SIM ==="
      prepare_ios_simulator "$SIM"
      if [[ -n "${MAESTRO_IOS_APP_CACHE_DIR:-}" ]]; then
        maestro_restore_ios_app_artifact "$MAESTRO_IOS_APP_CACHE_DIR" || true
      fi
      maestro_audit_ios_app_e2e_bake "${IOS_APP_BINARY:-}" "$ARTIFACTS/app-env-audit.txt"
      run_ios_on_simulator
      export MAESTRO_PLATFORM="ios-${IOS_SIM_NAME// /-}"
      run_diag_flows "$MAESTRO_PLATFORM"
    done
  fi
}

run_android() {
  cd "$ROOT"
  if [[ "$PHASE" == "build" || "$PHASE" == "all" ]]; then
    maestro_android_prebuild "$ROOT"
    maestro_android_assemble_release "$ROOT"
    if [[ -n "${MAESTRO_ANDROID_APK_STAGING_DIR:-}" ]]; then
      maestro_stage_android_apk "$ROOT" "$MAESTRO_ANDROID_APK_STAGING_DIR"
    fi
  fi
  if [[ "$PHASE" == "test" || "$PHASE" == "all" ]]; then
    if [[ -n "${MAESTRO_ANDROID_APK_CACHE_DIR:-}" && -f "$MAESTRO_ANDROID_APK_CACHE_DIR/app-release.apk" ]]; then
      adb install -r "$MAESTRO_ANDROID_APK_CACHE_DIR/app-release.apk" || true
    fi
    export MAESTRO_PLATFORM="android"
    run_diag_flows "android"
  fi
}

case "$PLATFORM" in
  ios) run_ios ;;
  android) run_android ;;
  both) run_ios; run_android ;;
  *) echo "Unknown platform: $PLATFORM"; exit 1 ;;
esac

maestro_collect_screenshots "$ARTIFACTS"
echo "Diagnostics artifacts: $ARTIFACTS"

if [[ "$LAYOUT_DIAG_FAILURES" -gt 0 ]]; then
  echo "::error::Groups layout diagnostics had $LAYOUT_DIAG_FAILURES failure(s)"
  exit 1
fi
