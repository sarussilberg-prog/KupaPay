#!/usr/bin/env bash
# Shared native build + Maestro flow runner for device UI CI.
set -euo pipefail

# Expo inlines EXPO_PUBLIC_* at bundle time — shell exports alone are not enough for Release Xcode builds.
maestro_write_mobile_e2e_env() {
  local mobile_root="$1"
  local env_file="$mobile_root/.env"
  cat > "$env_file" <<EOF
EXPO_PUBLIC_E2E_MAESTRO_AUTH=true
EXPO_PUBLIC_E2E_TEST_EMAIL=${E2E_EMAIL:-${E2E_TEST_EMAIL:-e2e-playwright@kupay-dev.test}}
EXPO_PUBLIC_SUPABASE_URL=${EXPO_PUBLIC_SUPABASE_URL:-${E2E_SUPABASE_URL:-}}
EXPO_PUBLIC_SUPABASE_ANON_KEY=${EXPO_PUBLIC_SUPABASE_ANON_KEY:-${E2E_SUPABASE_ANON_KEY:-}}
EOF
  echo "Wrote Maestro E2E env for bundle bake: $env_file"
}

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
  maestro_write_mobile_e2e_env "$mobile_root"
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
  if [[ -z "${SENTRY_AUTH_TOKEN:-}" ]]; then
    export SENTRY_DISABLE_AUTO_UPLOAD="${SENTRY_DISABLE_AUTO_UPLOAD:-true}"
  fi
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

# Release .app must embed Maestro E2E auth UI (baked at compile time, not runtime env).
maestro_audit_ios_app_e2e_bake() {
  local app_dir="${1:-${IOS_APP_BINARY:-}}"
  local audit_file="${2:-}"
  if [[ -z "$app_dir" || ! -d "$app_dir" ]]; then
    echo "::error::maestro_audit_ios_app_e2e_bake: missing .app directory"
    return 1
  fi
  local bundle=""
  bundle="$(find "$app_dir" -maxdepth 3 \( -name 'main.jsbundle' -o -name '*.jsbundle' \) 2>/dev/null | head -1 || true)"
  local lines=()
  lines+=("app_dir=$app_dir")
  lines+=("jsbundle=${bundle:-<not found>}")
  if [[ -n "$bundle" && -f "$bundle" ]]; then
    if strings "$bundle" | grep -q 'login-e2e-panel'; then
      lines+=('baked_login_e2e_panel=yes')
    else
      lines+=('baked_login_e2e_panel=no')
    fi
    if strings "$bundle" | grep -q 'E2E sign-in (CI only)'; then
      lines+=('baked_e2e_sign_in_label=yes')
    else
      lines+=('baked_e2e_sign_in_label=no')
    fi
  fi
  local report
  report="$(printf '%s\n' "${lines[@]}")"
  echo "$report"
  if [[ -n "$audit_file" ]]; then
    mkdir -p "$(dirname "$audit_file")"
    printf '%s\n' "$report" > "$audit_file"
  fi
  if [[ "$report" == *'baked_login_e2e_panel=no'* ]]; then
    echo "::error::iOS app bundle missing baked Maestro E2E auth (build without EXPO_PUBLIC_E2E_MAESTRO_AUTH in .env)"
    return 1
  fi
  return 0
}

maestro_collect_maestro_failure_debug() {
  local artifacts_dir="$1"
  local label="$2"
  mkdir -p "$artifacts_dir/debug"
  local latest
  latest="$(ls -td "$HOME/.maestro/tests"/* 2>/dev/null | head -1 || true)"
  if [[ -n "${latest:-}" ]]; then
    tar -czf "$artifacts_dir/debug/${label}-maestro-test-dir.tgz" -C "$(dirname "$latest")" "$(basename "$latest")" 2>/dev/null || true
    find "$latest" -type f \( -name '*.png' -o -name '*.xml' -o -name '*.json' \) -exec cp {} "$artifacts_dir/debug/" \; 2>/dev/null || true
  fi
  if command -v maestro >/dev/null 2>&1; then
    maestro hierarchy > "$artifacts_dir/debug/${label}-hierarchy.txt" 2>&1 || true
  fi
}

maestro_collect_ios_simulator_logs() {
  local artifacts_dir="$1"
  local label="$2"
  mkdir -p "$artifacts_dir/debug"
  if [[ -z "${IOS_SIM_UDID:-}" ]]; then
    return 0
  fi
  xcrun simctl spawn "$IOS_SIM_UDID" log show --style compact --last 8m \
    > "$artifacts_dir/debug/${label}-simulator.log" 2>&1 || true
}
