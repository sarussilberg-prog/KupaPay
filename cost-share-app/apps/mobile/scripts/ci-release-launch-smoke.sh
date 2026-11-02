#!/usr/bin/env bash
# Release-build launch smoke: install cached Release .app/APK, launch, stay alive 30s, no fatal crash.
set -euo pipefail

PLATFORM="${1:?Usage: ci-release-launch-smoke.sh ios|android|self-test}"
MODE="${2:-launch}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/ios-simulator-devices.sh
source "$SCRIPT_DIR/lib/ios-simulator-devices.sh"
# shellcheck source=lib/maestro-ci-build.sh
source "$SCRIPT_DIR/lib/maestro-ci-build.sh"

ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IOS_BUNDLE_ID="${IOS_BUNDLE_ID:-com.kupapay.mobile}"
ANDROID_PACKAGE="${ANDROID_PACKAGE:-com.kupapay.mobile}"
ALIVE_SECONDS="${RELEASE_LAUNCH_SMOKE_ALIVE_SECONDS:-30}"

release_launch_smoke_self_test() {
  if [[ "${RELEASE_LAUNCH_SMOKE_INJECT_CRASH:-}" == "1" ]]; then
    echo "::error::RELEASE_LAUNCH_SMOKE_INJECT_CRASH=1 — simulated startup crash (self-test)"
    return 1
  fi
  echo "Launch smoke self-test OK (no inject flag)"
  return 0
}

ios_sim_process_running() {
  local pid="$1"
  if [[ -n "$pid" ]] && xcrun simctl spawn booted kill -0 "$pid" 2>/dev/null; then
    return 0
  fi
  xcrun simctl spawn booted pgrep -x KupaPay >/dev/null 2>&1
}

ios_wait_for_process() {
  local pid="$1"
  local elapsed=0
  while (( elapsed < ALIVE_SECONDS )); do
    if ! ios_sim_process_running "$pid"; then
      echo "::error::KupaPay iOS process exited before ${ALIVE_SECONDS}s (last pid=$pid)"
      return 1
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  echo "iOS app alive for ${ALIVE_SECONDS}s (pid=$pid)"
  return 0
}

ios_check_crash_logs() {
  local crash_dir="$HOME/Library/Logs/DiagnosticReports"
  if [[ ! -d "$crash_dir" ]]; then
    return 0
  fi
  local recent
  recent="$(find "$crash_dir" -name 'KupaPay*.crash' -mmin -2 2>/dev/null | head -1 || true)"
  if [[ -n "$recent" ]]; then
    echo "::error::Recent iOS crash report: $recent"
    tail -n 40 "$recent" || true
    return 1
  fi
  return 0
}

run_ios_launch_smoke() {
  if [[ "${RELEASE_LAUNCH_SMOKE_INJECT_CRASH:-}" == "1" ]]; then
    echo "::error::Injected startup crash (RELEASE_LAUNCH_SMOKE_INJECT_CRASH=1)"
    return 1
  fi

  parse_ios_simulator_devices
  prepare_ios_simulator "${IOS_DEVICES[0]}"

  if [[ -n "${MAESTRO_IOS_APP_CACHE_DIR:-}" ]]; then
    maestro_restore_ios_app_artifact "$MAESTRO_IOS_APP_CACHE_DIR" || true
  fi
  if [[ -z "${IOS_APP_BINARY:-}" || ! -d "$IOS_APP_BINARY" ]]; then
    echo "::error::Release iOS app not found — set MAESTRO_IOS_APP_CACHE_DIR with KupaPay.app"
    return 1
  fi

  xcrun simctl install booted "$IOS_APP_BINARY"
  xcrun simctl terminate booted "$IOS_BUNDLE_ID" 2>/dev/null || true

  local launch_out pid
  launch_out="$(xcrun simctl launch booted "$IOS_BUNDLE_ID" 2>&1)" || {
    echo "::error::simctl launch failed: $launch_out"
    return 1
  }
  pid="${launch_out##*: }"
  pid="${pid// /}"

  sleep 3
  if ! xcrun simctl io booted screenshot /tmp/launch-smoke-ios.png 2>/dev/null; then
    echo "::notice::Could not capture launch screenshot (non-fatal)"
  fi

  ios_wait_for_process "$pid" || return 1
  ios_check_crash_logs || return 1
  return 0
}

run_android_launch_smoke() {
  if [[ "${RELEASE_LAUNCH_SMOKE_INJECT_CRASH:-}" == "1" ]]; then
    echo "::error::Injected startup crash (RELEASE_LAUNCH_SMOKE_INJECT_CRASH=1)"
    return 1
  fi

  local apk="${MAESTRO_ANDROID_APK_CACHE_DIR:-}/app-release.apk"
  if [[ ! -f "$apk" ]]; then
    echo "::error::Release APK not found at $apk"
    return 1
  fi

  adb wait-for-device
  adb install -r "$apk"
  adb logcat -c || true

  adb shell am force-stop "$ANDROID_PACKAGE" || true
  adb shell monkey -p "$ANDROID_PACKAGE" -c android.intent.category.LAUNCHER 1

  local elapsed=0
  while (( elapsed < ALIVE_SECONDS )); do
    if ! adb shell pidof "$ANDROID_PACKAGE" >/dev/null 2>&1; then
      echo "::error::Android process $ANDROID_PACKAGE not running after ${elapsed}s"
      adb logcat -d -t 200 | tail -n 80 || true
      return 1
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  if adb logcat -d -t 400 | grep -E 'FATAL EXCEPTION|AndroidRuntime.*FATAL' >/tmp/launch-smoke-fatal.txt 2>/dev/null; then
    echo "::error::FATAL in logcat during launch smoke"
    cat /tmp/launch-smoke-fatal.txt
    return 1
  fi

  echo "Android $ANDROID_PACKAGE alive for ${ALIVE_SECONDS}s with no FATAL logcat"
  return 0
}

case "$PLATFORM" in
  self-test)
    release_launch_smoke_self_test
    ;;
  ios)
    if [[ "$MODE" == "self-test" ]]; then
      release_launch_smoke_self_test
    else
      run_ios_launch_smoke
    fi
    ;;
  android)
    if [[ "$MODE" == "self-test" ]]; then
      release_launch_smoke_self_test
    else
      run_android_launch_smoke
    fi
    ;;
  *)
    echo "Unknown platform: $PLATFORM"
    exit 1
    ;;
esac
