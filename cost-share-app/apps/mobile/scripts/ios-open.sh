#!/usr/bin/env bash
# Re-open Expo Go on the booted iOS simulator with the current Metro URL.
# Use when pressing "i" leaves a blank/stale app (simulator already open).

set -euo pipefail

PORT="${EXPO_METRO_PORT:-8081}"
METRO_STATUS="http://127.0.0.1:${PORT}/status"
URLS=("exp://127.0.0.1:${PORT}" "exp://localhost:${PORT}")

if ! xcrun simctl list devices booted 2>/dev/null | grep -q Booted; then
  echo "No booted iOS simulator. Press i in Expo first, or open Simulator.app."
  exit 1
fi

tries=15
while [[ $tries -gt 0 ]]; do
  if curl -sf "$METRO_STATUS" 2>/dev/null | grep -q packager-status:running; then
    break
  fi
  sleep 0.4
  tries=$((tries - 1))
done

if [[ $tries -eq 0 ]]; then
  echo "Metro is not running on port ${PORT}. Start Expo first (npm run start)."
  exit 1
fi

echo "Restarting Expo Go (Metro :${PORT})..."
xcrun simctl terminate booted host.exp.Exponent 2>/dev/null || true
sleep 0.5

opened=false
for url in "${URLS[@]}"; do
  if xcrun simctl openurl booted "$url" 2>/dev/null; then
    echo "Opened ${url}"
    opened=true
    break
  fi
done

if [[ "$opened" != true ]]; then
  echo "Failed to open Expo Go. Try: xcrun simctl openurl booted exp://127.0.0.1:${PORT}"
  exit 1
fi
