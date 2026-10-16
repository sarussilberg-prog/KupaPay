#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RAW="${1:-$ROOT/../../../store/screenshots/raw}"
mkdir -p "$RAW"
export MAESTRO_DRIVER_STARTUP_TIMEOUT=120000

LOCALES=(en-US he ru ar-SA fr-FR es-ES de-DE)
for loc in "${LOCALES[@]}"; do
  echo "Maestro locale=$loc"
  MAESTRO_LOCALE="$loc" maestro test -e LOCALE="$loc" "$ROOT/.maestro/asc/capture-all-screens.yaml" || true
done

# Maestro writes to ~/.maestro/tests — collect newest PNGs
LATEST="$(ls -td "$HOME/.maestro/tests"/* 2>/dev/null | head -1 || true)"
if [[ -n "${LATEST:-}" ]]; then
  find "$LATEST" -name '*.png' -exec cp {} "$RAW/" \;
  echo "Collected screenshots from $LATEST → $RAW"
else
  echo "No Maestro output; using fallback generator"
  node "$ROOT/scripts/asc-generate-screenshots-fallback.mjs"
fi

node "$ROOT/scripts/asc-compose-store-screenshots.mjs" "$RAW"
