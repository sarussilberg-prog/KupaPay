#!/usr/bin/env bash
# Legacy entrypoint — use supabase-lint + supabase-unique-migration-versions in CI.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bash "$ROOT/scripts/supabase-lint-migration-filenames.sh"
bash "$ROOT/scripts/supabase-unique-migration-versions.sh"
