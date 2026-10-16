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
  if compgen -G "*.ts" >/dev/null || compgen -G "**/*.ts" >/dev/null; then
    deno lint
  else
    echo "(no TypeScript sources — skip lint)"
  fi
)

echo "▶ deno test — $FN"
(cd "$DIR" && deno test --allow-env --allow-read)

echo "▶ deno check (deploy bundle) — $FN"
(cd "$DIR" && deno check --no-config index.ts)

echo "✅ $FN — lint, test, check passed"
