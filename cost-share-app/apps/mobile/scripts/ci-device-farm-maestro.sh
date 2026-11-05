#!/usr/bin/env bash
# Upload Release build to AWS Device Farm and schedule Maestro smoke on a device pool.
# Requires DEVICE_FARM_* secrets and AWS credentials (see docs/superpowers/specs/2026-11-02-aws-device-farm-setup.md).
set -euo pipefail

PLATFORM="${1:?Usage: ci-device-farm-maestro.sh ios|android}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/../../.." && pwd)"
REPORT_DIR="${DEVICE_FARM_REPORT_DIR:-$REPO_ROOT/artifacts/device-farm}"
mkdir -p "$REPORT_DIR"

PROJECT_ARN="${DEVICE_FARM_PROJECT_ARN:?DEVICE_FARM_PROJECT_ARN required}"
POOL_ARN="${DEVICE_FARM_DEVICE_POOL_ARN:?DEVICE_FARM_DEVICE_POOL_ARN required}"
RUN_NAME="kupay-maestro-smoke-${PLATFORM}-${GITHUB_RUN_ID:-local}-$(date +%Y%m%d%H%M%S)"

upload_android() {
  local apk="/tmp/maestro-android-apk/app-release.apk"
  if [[ ! -f "$apk" ]]; then
    echo "::error::Release APK not found at $apk — run Maestro Android build first or populate cache"
    return 1
  fi

  echo "Creating Device Farm upload for $(basename "$apk")…"
  local upload_json upload_arn
  upload_json="$(aws devicefarm create-upload \
    --project-arn "$PROJECT_ARN" \
    --name "kupay-release.apk" \
    --type "ANDROID_APP")"
  upload_arn="$(node -e "const u=JSON.parse(process.argv[1]); process.stdout.write(u.upload.arn)" "$upload_json")"
  local upload_url
  upload_url="$(node -e "const u=JSON.parse(process.argv[1]); process.stdout.write(u.upload.url)" "$upload_json")"

  curl -T "$apk" "$upload_url"
  aws devicefarm wait upload-success --arn "$upload_arn"

  echo "Scheduling Device Farm run $RUN_NAME on pool $POOL_ARN"
  local run_json
  run_json="$(aws devicefarm schedule-run \
    --project-arn "$PROJECT_ARN" \
    --app-arn "$upload_arn" \
    --device-pool-arn "$POOL_ARN" \
    --name "$RUN_NAME" \
    --test type=APPIUM_NODE,testPackageArn="${DEVICE_FARM_TEST_PACKAGE_ARN:-}",testSpecArn="${DEVICE_FARM_TEST_SPEC_ARN:-}")" || {
    echo "::notice::schedule-run may require DEVICE_FARM_TEST_PACKAGE_ARN / TEST_SPEC_ARN — see setup doc"
    echo "$run_json" > "$REPORT_DIR/schedule-run-error.json"
    return 1
  }

  echo "$run_json" | tee "$REPORT_DIR/run-${PLATFORM}.json"
  local run_arn
  run_arn="$(node -e "const r=JSON.parse(require('fs').readFileSync(0,'utf8')); process.stdout.write(r.run.arn)" <<< "$run_json")"
  aws devicefarm wait run-complete --arn "$run_arn"

  local result
  result="$(aws devicefarm get-run --arn "$run_arn")"
  echo "$result" > "$REPORT_DIR/run-${PLATFORM}-result.json"
  local outcome
  outcome="$(node -e "const r=JSON.parse(require('fs').readFileSync(0,'utf8')); process.stdout.write(r.run.result)" <<< "$result")"
  if [[ "$outcome" != "PASSED" ]]; then
    echo "::error::Device Farm run $outcome"
    return 1
  fi
  echo "Device Farm run PASSED: $run_arn"
}

upload_ios() {
  local ipa="${DEVICE_FARM_IOS_APP_PATH:-}"
  if [[ -z "$ipa" || ! -f "$ipa" ]]; then
    echo "::error::Set DEVICE_FARM_IOS_APP_PATH to a signed .ipa built for Device Farm"
    return 1
  fi
  echo "iOS upload path configured: $ipa (same schedule-run flow as Android with type IOS_APP)"
  # Nave: mirror upload_android with IOS_APP when ipa pipeline is wired.
  return 1
}

case "$PLATFORM" in
  android) upload_android ;;
  ios) upload_ios ;;
  *) echo "Unknown platform: $PLATFORM"; exit 1 ;;
esac
