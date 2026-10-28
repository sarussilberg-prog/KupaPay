#!/usr/bin/env bash
# Ensure offline schema-contract seed matches committed snapshot (name sets only).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMMITTED="${SCHEMA_CONTRACT_SNAPSHOT:-supabase/ci/schema-contract.snapshot.json}"
if [[ ! -f "$COMMITTED" ]]; then
  echo "::error::Missing $COMMITTED"
  exit 1
fi

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
SCHEMA_CONTRACT_SNAPSHOT="$TMP" bash "$ROOT/scripts/build-schema-contract-snapshot-offline.sh" >/dev/null

normalize() {
  jq -S 'del(.generated_at, .description)
    | {tables: ([.tables[].name] | sort), functions: ([.functions[].name] | unique | sort)}'
}

OFFLINE_NORM="$(normalize < "$TMP")"
BASE_NORM="$(normalize < "$COMMITTED")"

if [[ "$OFFLINE_NORM" == "$BASE_NORM" ]]; then
  echo "✅ Offline schema contract seed matches $COMMITTED"
  exit 0
fi

echo "::error::Offline schema contract seed drift — run bash scripts/build-schema-contract-snapshot-offline.sh and commit $COMMITTED"
diff -u <(echo "$BASE_NORM" | jq .) <(echo "$OFFLINE_NORM" | jq .) || true
exit 1
