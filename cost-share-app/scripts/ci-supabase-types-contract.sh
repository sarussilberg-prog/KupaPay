#!/usr/bin/env bash
# Wrapper: RPC/table contract test via schema snapshot (post-migration SQL CI DB).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bash "$ROOT/scripts/ci-supabase-schema-contract.sh"
