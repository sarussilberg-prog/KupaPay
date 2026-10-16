#!/usr/bin/env bash
# Run Deno tests for all edge functions that ship handler tests (Phase 0 Gate A).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mapfile -t FUNCTIONS < <(
  for dir in "$ROOT/supabase/functions"/*/; do
    [[ -f "${dir}index.ts" ]] || continue
    basename "$dir"
  done | sort
)

for fn in "${FUNCTIONS[@]}"; do
  if [[ ! -d "$ROOT/supabase/functions/$fn" ]]; then
    echo "::error::missing edge function directory: $fn"
    exit 1
  fi
  bash "$ROOT/scripts/ci-deno-edge-function.sh" "$fn"
done

echo "✅ All Deno edge tests passed"
