#!/usr/bin/env bash
# Type-check edge function entrypoints the way Supabase deploy bundles them:
# deploy does not apply deno.json import maps, so bare "supabase" aliases fail at runtime.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FUNCTIONS_DIR="$ROOT/supabase/functions"

shopt -s nullglob
dirs=("$FUNCTIONS_DIR"/*/)
if [[ ${#dirs[@]} -eq 0 ]]; then
  echo "::error::no edge function directories"
  exit 1
fi

for dir in "${dirs[@]}"; do
  fn="$(basename "$dir")"
  if [[ ! -f "$dir/index.ts" ]]; then
    continue
  fi
  echo "▶ deno check (deploy bundle) — $fn"
  (cd "$dir" && deno check --no-config index.ts)
done

echo "✅ Edge function deploy bundle checks passed"
