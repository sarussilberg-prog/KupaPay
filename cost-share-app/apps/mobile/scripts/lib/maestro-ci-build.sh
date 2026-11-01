#!/usr/bin/env bash
# Shared native build + Maestro flow runner for device UI CI.
set -euo pipefail

maestro_ensure_cli() {
  if command -v maestro >/dev/null 2>&1; then
    return 0
  fi
  echo "Installing Maestro CLI…"
  curl -Ls "https://get.maestro.mobile.dev" | bash
  export PATH="$PATH:$HOME/.maestro/bin"
}

maestro_seed_e2e_if_configured() {
  local cost_share="$1"
  cd "$cost_share"
  if [[ -n "${SUPABASE_URL:-}" && -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
    npm run seed:e2e
  else
    echo "::notice::Skipping seed:e2e — Supabase service-role secrets not set"
  fi
}

maestro_ios_prebuild_and_pods() {
  local mobile_root="$1"
  cd "$mobile_root"
  if [[ "${MAESTRO_SKIP_NATIVE_REBUILD:-false}" == "true" && -d ios/Pods ]]; then
    echo "::notice::Skipping expo prebuild/pod install (JS-only change; reuse native tree)"
    return 0
  fi
  npx expo prebuild --platform ios --no-install
  (cd ios && pod install)
}

maestro_android_prebuild() {
  local mobile_root="$1"
  cd "$mobile_root"
  if [[ "${MAESTRO_SKIP_NATIVE_REBUILD:-false}" == "true" && -d android ]]; then
    echo "::notice::Skipping android prebuild (JS-only change)"
    return 0
  fi
  npx expo prebuild --platform android --no-install
}

maestro_android_assemble_release() {
  local mobile_root="$1"
  cd "$mobile_root/android"
  ./gradlew assembleRelease -x lint -x test
}

maestro_stage_ios_app_artifact() {
  local dest="$1"
  local app="${IOS_APP_BINARY:-}"
  if [[ -z "$app" || ! -d "$app" ]]; then
    app="$(find_ios_sim_app_bundle)"
  fi
  if [[ -z "$app" || ! -d "$app" ]]; then
    echo "::error::Could not locate KupaPay.app for artifact staging"
    return 1
  fi
  rm -rf "$dest"
  mkdir -p "$dest"
  ditto "$app" "$dest/KupaPay.app"
  echo "$dest/KupaPay.app" > "${dest}/../ios-app-path.txt"
}

maestro_restore_ios_app_artifact() {
  local src="$1"
  if [[ -d "$src/KupaPay.app" ]]; then
    IOS_APP_BINARY="$src/KupaPay.app"
    export IOS_APP_BINARY
    echo "Restored iOS app bundle: $IOS_APP_BINARY"
    return 0
  fi
  return 1
}

maestro_stage_android_apk() {
  local mobile_root="$1"
  local dest="$2"
  local apk
  apk="$(find "$mobile_root/android/app/build/outputs/apk" -name '*release*.apk' 2>/dev/null | head -1 || true)"
  if [[ -z "$apk" ]]; then
    echo "::error::Release APK not found under android/app/build/outputs/apk"
    return 1
  fi
  mkdir -p "$dest"
  cp "$apk" "$dest/app-release.apk"
}

maestro_run_flow_plan() {
  local mobile_root="$1"
  local flow_plan_json="$2"
  local maestro_platform="${MAESTRO_PLATFORM:-ios}"

  if [[ -z "$flow_plan_json" ]]; then
    echo "::error::MAESTRO_FLOW_PLAN_JSON is empty"
    return 1
  fi

  local count
  count="$(node -e "const p=JSON.parse(process.argv[1]); process.stdout.write(String(p.length));" "$flow_plan_json")"
  local i
  for ((i = 0; i < count; i++)); do
    local file locales_json loc loc_count j
    file="$(node -e "const p=JSON.parse(process.argv[1]); process.stdout.write(p[Number(process.argv[2])].file);" "$flow_plan_json" "$i")"
    locales_json="$(node -e "const p=JSON.parse(process.argv[1]); process.stdout.write(JSON.stringify(p[Number(process.argv[2])].locales));" "$flow_plan_json" "$i")"
    loc_count=1
    if [[ "$locales_json" != "null" ]]; then
      loc_count="$(node -e "process.stdout.write(String(JSON.parse(process.argv[1]).length));" "$locales_json")"
    fi
    for ((j = 0; j < loc_count; j++)); do
      local -a maestro_args=(
        test
        -e "MAESTRO_PLATFORM=$maestro_platform"
      )
      if [[ "$locales_json" != "null" ]]; then
        loc="$(node -e "process.stdout.write(JSON.parse(process.argv[1])[Number(process.argv[2])]);" "$locales_json" "$j")"
        maestro_args+=(-e "APP_LANG=$loc")
      fi
      if [[ -n "${E2E_EMAIL:-}" ]]; then
        maestro_args+=(-e "E2E_EMAIL=$E2E_EMAIL")
      fi
      if [[ -n "${E2E_TEST_PASSWORD:-}" ]]; then
        maestro_args+=(-e "E2E_PASSWORD=$E2E_TEST_PASSWORD")
      fi
      maestro_args+=("$mobile_root/.maestro/device-ui/$file")
      echo "Maestro flow: $file ${loc:-}"
      maestro "${maestro_args[@]}"
    done
  done
}

maestro_collect_screenshots() {
  local artifacts_dir="$1"
  mkdir -p "$artifacts_dir/screenshots"
  local latest
  latest="$(ls -td "$HOME/.maestro/tests"/* 2>/dev/null | head -1 || true)"
  if [[ -n "${latest:-}" ]]; then
    find "$latest" -name '*.png' -exec cp {} "$artifacts_dir/screenshots/" \;
  fi
}
