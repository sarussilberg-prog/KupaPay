#!/usr/bin/env bash
# Layer 2 group ledger simulation against bootstrapped local Postgres (#641).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/ci-supabase-sql-lib.sh
source "$ROOT/scripts/ci-supabase-sql-lib.sh"

if ! postgres_container_running; then
  echo "::error::Postgres container ${PG_CONTAINER} is not running"
  exit 1
fi

echo "▶ Group ledger simulation — DB integration (seed=${GROUP_LEDGER_SIM_SEED:-641641})"
npx ts-node --project packages/shared/tsconfig.json \
  --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \
  --transpile-only scripts/group-ledger-simulation-db.integration.ts
