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
TOUR_FLOW_BASENAME="groups-layout-diagnostics-tour"
LOCALES=(en he)
LAYOUT_DIAG_FAILURES=0

export EXPO_PUBLIC_E2E_FIXTURES="${EXPO_PUBLIC_E2E_FIXTURES:-1}"
export EXPO_PUBLIC_E2E=1
export EXPO_PUBLIC_SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-${E2E_SUPABASE_URL:-}}"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-${E2E_SUPABASE_ANON_KEY:-}}"
export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-180000}"
LAYOUT_FIXTURE_MODE=false
if [[ "${EXPO_PUBLIC_E2E_FIXTURES:-}" == "1" ]]; then
  LAYOUT_FIXTURE_MODE=true
fi

if [[ ! -f "$ROOT/.maestro/device-ui/${TOUR_FLOW_BASENAME}-en.yaml" ]]; then
  echo "::notice::Skipping groups layout diagnostics — locale tours not present (enable with Phase 1 diagnostics PR)"
  exit 0
fi

if [[ "$LAYOUT_FIXTURE_MODE" != "true" && -z "${E2E_TEST_PASSWORD:-}" ]]; then
  echo "::error::E2E_TEST_PASSWORD is required for layout diagnostics (non-fixture mode)"
  exit 1
fi

export E2E_EMAIL="${E2E_TEST_EMAIL:-e2e-playwright@kupay-dev.test}"
export EXPO_PUBLIC_E2E_TEST_EMAIL="$E2E_EMAIL"

maestro_ensure_cli
if [[ -n "${E2E_SUPABASE_URL:-}" && -n "${E2E_SUPABASE_ANON_KEY:-}" ]]; then
  set +e
  curl -sf "${E2E_SUPABASE_URL}/auth/v1/health" -H "apikey: ${E2E_SUPABASE_ANON_KEY}" >/dev/null
  curl_rc=$?
  set -e
  if [[ "$curl_rc" -eq 0 ]]; then
    echo "Dev Supabase reachable from CI runner (auth health OK, diagnostic)"
  else
    echo "::warning::Runner dev Supabase health check failed (rc=$curl_rc); layout fixture mode does not require it"
  fi
fi
maestro_write_mobile_e2e_env "$ROOT"
if [[ "$LAYOUT_FIXTURE_MODE" != "true" ]]; then
  maestro_seed_e2e_if_configured "$COST_SHARE"
fi
mkdir -p "$ARTIFACTS/json" "$ARTIFACTS/screenshots" "$ARTIFACTS/logs" "$ARTIFACTS/debug"
export MAESTRO_SUPABASE_AUDIT_FILE="$ARTIFACTS/app-env-audit.txt"
: > "$MAESTRO_SUPABASE_AUDIT_FILE"
EXPECTED_SUPABASE_HOST=""
if [[ -n "${E2E_SUPABASE_URL:-}" ]]; then
  EXPECTED_SUPABASE_HOST="$(node -e "try{console.log(new URL(process.argv[1]).hostname)}catch{}" "${E2E_SUPABASE_URL}")"
  echo "expected_supabase_host=${EXPECTED_SUPABASE_HOST}" >> "$MAESTRO_SUPABASE_AUDIT_FILE"
fi

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
  layout_diag_simulator_supabase_health || true
  local loc
  for loc in "${LOCALES[@]}"; do
    local tour_flow="$ROOT/.maestro/device-ui/${TOUR_FLOW_BASENAME}-${loc}.yaml"
    if [[ ! -f "$tour_flow" ]]; then
      echo "::error::Missing Maestro tour for locale $loc ($tour_flow)"
      layout_diag_record_failure
      continue
    fi
    set +e
    local -a maestro_args=(
      test
      -e "APP_LANG=$loc"
      -e "MAESTRO_PLATFORM=$maestro_platform"
    )
    if [[ -n "${E2E_TEST_PASSWORD:-}" ]]; then
      maestro_args+=(-e "E2E_EMAIL=$E2E_EMAIL" -e "E2E_PASSWORD=$E2E_TEST_PASSWORD")
    fi
    maestro_args+=("$tour_flow")
    maestro "${maestro_args[@]}" \
      2>&1 | tee "$ARTIFACTS/logs/${maestro_platform}_${loc}.log"
    exit_code=$?
    set -e
    echo "$exit_code" > "$ARTIFACTS/logs/${maestro_platform}_${loc}.exit"
    maestro_collect_ios_simulator_logs "$ARTIFACTS" "${maestro_platform}_${loc}"
    layout_diag_extract_json() {
      local dest="$1"
      local maestro_log="$2"
      local sim_log="$3"
      grep -o '\[LAYOUT_DIAG_JSON\].*' "$maestro_log" \
        | sed 's/^\[LAYOUT_DIAG_JSON\] //' \
        | tail -1 > "$dest" 2>/dev/null || true
      if [[ ! -s "$dest" && -f "$sim_log" ]]; then
        grep -o '\[LAYOUT_DIAG_JSON\].*' "$sim_log" \
          | sed 's/^\[LAYOUT_DIAG_JSON\] //' \
          | tail -1 > "$dest" 2>/dev/null || true
      fi
    }
    layout_diag_extract_json \
      "$ARTIFACTS/json/${maestro_platform}_${loc}.json" \
      "$ARTIFACTS/logs/${maestro_platform}_${loc}.log" \
      "$ARTIFACTS/debug/${maestro_platform}_${loc}-simulator.log"
    maestro_append_supabase_host_audit "$MAESTRO_SUPABASE_AUDIT_FILE" \
      "$ARTIFACTS/debug/${maestro_platform}_${loc}-simulator.log" "${maestro_platform}_${loc}"
    if [[ "$exit_code" -ne 0 ]]; then
      echo "::error::Maestro layout diagnostics failed for $maestro_platform / $loc (exit $exit_code)"
      layout_diag_record_failure
      maestro_collect_maestro_failure_debug "$ARTIFACTS" "${maestro_platform}_${loc}"
    fi
    layout_diag_assert_json_nonempty "$ARTIFACTS/json/${maestro_platform}_${loc}.json" "${maestro_platform}_${loc}" || true
  done
}

run_ios() {
  if [[ "$PHASE" == "build" || "$PHASE" == "all" ]]; then
    maestro_ios_prebuild_and_pods "$ROOT"
    parse_ios_simulator_devices
    prepare_ios_simulator "${IOS_DEVICES[0]}"
    run_ios_on_simulator
    if [[ -n "${MAESTRO_IOS_APP_STAGING_DIR:-}" ]]; then
      maestro_stage_ios_app_artifact "$MAESTRO_IOS_APP_STAGING_DIR"
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
      install_ios_release_on_simulator
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

if [[ "$LAYOUT_FIXTURE_MODE" != "true" ]]; then
  maestro_verify_supabase_host_in_logs "$MAESTRO_SUPABASE_AUDIT_FILE" "$EXPECTED_SUPABASE_HOST" || layout_diag_record_failure
else
  echo "Skipping Supabase host audit — layout fixture mode (no live Supabase in app)"
fi

if [[ "$LAYOUT_DIAG_FAILURES" -gt 0 ]]; then
  echo "::error::Groups layout diagnostics had $LAYOUT_DIAG_FAILURES failure(s)"
  exit 1
fi
