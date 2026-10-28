#!/usr/bin/env bash
# Fail fast when the shared install artifact is incomplete — never run npm ci in downstream jobs.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ $# -lt 1 ]]; then
  echo "::error::Usage: ci-assert-install-artifact.sh <bin> [<bin>...]" >&2
  exit 1
fi

declare -A BIN_ENTRY=(
  [jest]=jest/bin/jest.js
  [turbo]=turbo/bin/turbo
  [tsc]=typescript/bin/tsc
  [expo]=expo/bin/cli
  [knip]=knip/bin/knip.js
)

ensure_executable() {
  local bin="$1"
  local shim="node_modules/.bin/$bin"
  if [[ -x "$shim" ]]; then
    return 0
  fi

  local rel="${BIN_ENTRY[$bin]:-}"
  if [[ -n "$rel" && -f "node_modules/$rel" ]]; then
    chmod +x "node_modules/$rel" || true
  fi

  if [[ -x "$shim" ]]; then
    return 0
  fi

  if [[ -n "$rel" && -f "node_modules/$rel" ]]; then
    echo "::warning::node_modules/.bin/$bin not executable after artifact restore; package entry exists at $rel (npm scripts may still work)."
    return 0
  fi

  echo "::error::Install artifact missing CLI '$bin' (expected node_modules/.bin/$bin). Re-run the workflow; downstream jobs must not run npm ci." >&2
  exit 1
}

for bin in "$@"; do
  ensure_executable "$bin"
done
