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
  local line udid name
  line="$(xcrun simctl list devices available 2>/dev/null | grep -F "${want} (" | head -1 || true)"
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
