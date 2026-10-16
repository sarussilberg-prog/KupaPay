#!/usr/bin/env bash
# SQL regression tests (Phase 0 Gate B).
# CI: Supabase Postgres 17 Docker (pg_net, auth, vault) + schema bootstrap.
# Each __tests__ file uses BEGIN/ROLLBACK — no persistent writes.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/ci-supabase-sql-lib.sh
source "$ROOT/scripts/ci-supabase-sql-lib.sh"

cleanup() {
  remove_pg_container
}
trap cleanup EXIT

bash "$ROOT/scripts/ci-supabase-sql-bootstrap.sh"
bash "$ROOT/scripts/ci-supabase-sql-run-tests.sh"
