#!/usr/bin/env bash
# Start Expo with a real TTY (QR + w/i/a keys) and auto-run ios-open after "Opening on iOS".
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PORT="${EXPO_METRO_PORT:-8081}"
LOG="${TMPDIR:-/tmp}/kupa-expo-$$.log"
IOS_OPEN="$SCRIPT_DIR/ios-open.sh"

WATCHER_PID=""

cleanup() {
  if [[ -n "$WATCHER_PID" ]]; then
    kill "$WATCHER_PID" 2>/dev/null || true
  fi
  rm -f "$LOG"
}
trap cleanup EXIT INT TERM

start_ios_watcher() {
  touch "$LOG"
  (
    tail -n 0 -f "$LOG" 2>/dev/null | while IFS= read -r line; do
      if [[ "$line" == *"Opening on iOS"* ]] || [[ "$line" == *"Opening exp://"* ]]; then
        sleep 1.2
        EXPO_METRO_PORT="$PORT" bash "$IOS_OPEN" 2>/dev/null || true
      fi
    done
  ) &
  WATCHER_PID=$!
}

cd "$MOBILE_DIR"

run_expo() {
  exec npx expo start --localhost --port "$PORT"
}

# Node wrapper piped stdout and hid the QR / key menu. script(1) keeps a PTY in real terminals.
if [[ -t 0 && -t 1 ]] && command -v script >/dev/null 2>&1; then
  start_ios_watcher
  if script -q "$LOG" npx expo start --localhost --port "$PORT"; then
    :
  else
    kill "$WATCHER_PID" 2>/dev/null || true
    WATCHER_PID=""
    run_expo
  fi
else
  run_expo
fi
