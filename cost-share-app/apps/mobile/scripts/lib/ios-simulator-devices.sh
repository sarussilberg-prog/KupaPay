#!/usr/bin/env bash
# Parse IOS_SIMULATOR_DEVICES into IOS_DEVICES[] (names may contain spaces).
# Separators: semicolon, newline. Do not use whitespace — "iPhone 16" would split wrongly.
parse_ios_simulator_devices() {
  local raw="${IOS_SIMULATOR_DEVICES:-iPhone SE (3rd generation);iPhone 16;iPhone 16 Pro Max}"
  raw="${raw//$'\n'/;}"
  IOS_DEVICES=()
  local IFS=';'
  local -a parts=()
  read -ra parts <<< "$raw"
  local p
  for p in "${parts[@]}"; do
    p="${p#"${p%%[![:space:]]*}"}"
    p="${p%"${p##*[![:space:]]}"}"
    if [[ -n "$p" ]]; then
      IOS_DEVICES+=("$p")
    fi
  done
  if [[ ${#IOS_DEVICES[@]} -eq 0 ]]; then
    echo "::error::IOS_SIMULATOR_DEVICES parsed to zero simulators (use semicolon-separated names)"
    return 1
  fi
}

# Map a human name (e.g. "iPhone 16") to an installed simulator name + UDID on this Mac.
resolve_ios_simulator() {
  local want="$1"
  local line udid name candidate
  local -a candidates=("$want")
  case "$want" in
    "iPhone SE (3rd generation)"|*SE*)
      candidates+=("iPhone 16e" "iPhone 17e" "iPhone SE (3rd generation)")
      ;;
    "iPhone 16")
      candidates+=("iPhone 17" "iPhone 16" "iPhone 16e")
      ;;
    "iPhone 16 Pro Max")
      candidates+=("iPhone 17 Pro Max" "iPhone 16 Pro Max")
      ;;
  esac
  line=""
  for candidate in "${candidates[@]}"; do
    line="$(xcrun simctl list devices available 2>/dev/null | grep -F "${candidate} (" | head -1 || true)"
    if [[ -n "$line" ]]; then
      want="$candidate"
      break
    fi
  done
  if [[ -z "$line" ]]; then
    line="$(xcrun simctl list devices available 2>/dev/null | grep -Fi "${want}" | grep -E '\([0-9A-Fa-f-]{36}\)' | head -1 || true)"
  fi
  if [[ -z "$line" ]]; then
    echo "::error::No available iOS Simulator matching \"${want}\". Available iPhones:" >&2
    xcrun simctl list devices available 2>/dev/null | grep -i iphone | head -20 >&2 || true
    return 1
  fi
  udid="$(grep -oE '[0-9A-Fa-f-]{36}' <<< "$line" | head -1)"
  name="$(sed -E 's/^[[:space:]]+//; s/ \([0-9A-Fa-f-]{36}\).*//' <<< "$line")"
  IOS_SIM_NAME="$name"
  IOS_SIM_UDID="$udid"
}

prepare_ios_simulator() {
  local want="$1"
  resolve_ios_simulator "$want" || return 1
  echo "Using simulator: ${IOS_SIM_NAME} (${IOS_SIM_UDID})"
  xcrun simctl boot "$IOS_SIM_UDID" 2>/dev/null || true
  xcrun simctl bootstatus "$IOS_SIM_UDID" -b 2>/dev/null || true
  open -a Simulator >/dev/null 2>&1 || true
}

find_ios_sim_app_bundle() {
  find "$HOME/Library/Developer/Xcode/DerivedData" -name 'KupaPay.app' -path '*Release-iphonesimulator*' 2>/dev/null | head -1
}

# First simulator: full Release build. Later simulators: reinstall existing .app via --binary.
IOS_APP_BINARY=""

run_ios_on_simulator() {
  # Release on CI: compile/install only — never start Metro or open expo-development-client URLs.
  if [[ -n "$IOS_APP_BINARY" && -d "$IOS_APP_BINARY" ]]; then
    echo "Reusing built app: $IOS_APP_BINARY"
    npx expo run:ios --device "$IOS_SIM_UDID" --configuration Release --binary "$IOS_APP_BINARY" --no-bundler
  else
    npx expo run:ios --device "$IOS_SIM_UDID" --configuration Release --no-bundler
    IOS_APP_BINARY="$(find_ios_sim_app_bundle)"
    echo "Built app bundle: ${IOS_APP_BINARY:-<not found>}"
  fi
}

# Install the Release .app and launch the production bundle (Maestro may relaunch with clearState).
install_ios_release_on_simulator() {
  local app="${IOS_APP_BINARY:-}"
  if [[ -z "$app" || ! -d "$app" ]]; then
    app="$(find_ios_sim_app_bundle)"
  fi
  if [[ -z "$app" || ! -d "$app" ]]; then
    echo "::error::No KupaPay.app found to install on simulator"
    return 1
  fi
  IOS_APP_BINARY="$app"
  export IOS_APP_BINARY
  echo "Installing Release app on ${IOS_SIM_NAME}: $app"
  xcrun simctl install "$IOS_SIM_UDID" "$app"
}

launch_ios_release_on_simulator() {
  install_ios_release_on_simulator || return 1
  echo "Launching com.kupapay.mobile on ${IOS_SIM_UDID}"
  xcrun simctl launch "$IOS_SIM_UDID" com.kupapay.mobile || true
}

layout_diag_simulator_supabase_health() {
  set +e
  local code
  code="$(xcrun simctl spawn booted curl -sS -o /dev/null -w '%{http_code}' \
    https://drxfbicunusmipdgbgdk.supabase.co/auth/v1/health 2>&1 || true)"
  set -e
  echo "simulator_supabase_auth_health_http=${code} (diagnostic only, non-blocking)"
}

