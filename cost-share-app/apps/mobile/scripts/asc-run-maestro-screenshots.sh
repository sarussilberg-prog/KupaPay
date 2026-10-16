#!/usr/bin/env bash
set -euo pipefail
# Optional native simulator capture — Playwright web export is the primary path in CI.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RAW="${1:-$ROOT/../../../store/screenshots/raw}"
mkdir -p "$RAW"
export MAESTRO_DRIVER_STARTUP_TIMEOUT=120000

LOCALES=(en-US he ru ar-SA fr-FR es-ES de-DE)
for loc in "${LOCALES[@]}"; do
  echo "Maestro locale=$loc"
  maestro test -e LOCALE="$loc" "$ROOT/.maestro/asc/capture-all-screens.yaml"
done

LATEST="$(ls -td "$HOME/.maestro/tests"/* 2>/dev/null | head -1 || true)"
if [[ -z "${LATEST:-}" ]]; then
  echo "::error::Maestro produced no screenshots"
  exit 1
fi
find "$LATEST" -name '*.png' -exec cp {} "$RAW/" \;
echo "Collected screenshots from $LATEST → $RAW"
