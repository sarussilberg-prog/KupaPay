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
