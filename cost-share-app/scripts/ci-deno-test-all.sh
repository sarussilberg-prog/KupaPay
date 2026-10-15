#!/usr/bin/env bash
# Run Deno tests for all edge functions that ship handler tests (Phase 0 Gate A).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FUNCTIONS=(
  revenuecat-webhook
  send-push
  pro-trial-reminder-dispatch
)

for fn in "${FUNCTIONS[@]}"; do
  dir="$ROOT/supabase/functions/$fn"
  if [[ ! -d "$dir" ]]; then
    echo "::error::missing edge function directory: $fn"
    exit 1
  fi
  echo "▶ deno test — $fn"
  (cd "$dir" && deno test --allow-env)
done

echo "✅ All Deno edge tests passed"
