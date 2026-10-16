#!/usr/bin/env bash
# lint + test + deploy-bundle check for one Supabase edge function directory.
set -euo pipefail

FN="${1:?usage: ci-deno-edge-function.sh <function-name>}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="$ROOT/supabase/functions/$FN"

if [[ ! -f "$DIR/index.ts" ]]; then
  echo "::error::missing index.ts for edge function: $FN"
  exit 1
fi

echo "▶ deno lint — $FN"
(
  cd "$DIR"
  # Deploy bundles use bare npm: imports (no import map on Supabase deploy); allow that in lint.
  deno lint \
    --rules-exclude=no-import-prefix \
    --rules-exclude=no-unversioned-import \
    --rules-exclude=no-explicit-any \
    --rules-exclude=require-await
)

echo "▶ deno test — $FN"
(
  cd "$DIR"
  shopt -s nullglob
  tests=(*.test.ts **/*.test.ts)
  if [[ ${#tests[@]} -eq 0 ]]; then
    echo "(no *.test.ts — skip deno test)"
  else
    deno test --allow-env --allow-read
  fi
)

echo "▶ deno check — deploy bundle — $FN"
(cd "$DIR" && deno check --no-config index.ts)

echo "✅ $FN — lint, test, check passed"
