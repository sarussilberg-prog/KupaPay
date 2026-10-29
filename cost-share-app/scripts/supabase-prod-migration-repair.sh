#!/usr/bin/env bash
# Optional production migration history repair (see docs/PROD_MIGRATION_REPAIR.md).
# Intentionally gated — never runs unless PROD_MIGRATION_REPAIR_MODE is set explicitly.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MODE="${PROD_MIGRATION_REPAIR_MODE:-none}"
DB_URL="$(bash scripts/supabase-migration-db-url.sh)"

case "$MODE" in
  none|'')
    echo "▶ Prod migration repair skipped (PROD_MIGRATION_REPAIR_MODE=none)."
    exit 0
    ;;
  path_b_pro_trial_applied)
    echo "▶ Path B: pro-trial cron SQL already on prod; record dev version 20261016120500 only."
    echo "   Confirm probes in docs/PROD_MIGRATION_REPAIR.md before using this mode."
    supabase migration repair --status applied 20261016120500 --db-url "$DB_URL" --yes
    ;;
  path_b_recurring_applied)
    echo "▶ Path B: recurring schema already on prod; record 20261016121500."
    supabase migration repair --status applied 20261016121500 --db-url "$DB_URL" --yes
    ;;
  path_b_pro_trial_and_recurring_applied)
    echo "▶ Path B: pro-trial + recurring already on prod; record 20261016120500 and 20261016121500."
    supabase migration repair --status applied 20261016120500 --db-url "$DB_URL" --yes
    supabase migration repair --status applied 20261016121500 --db-url "$DB_URL" --yes
    ;;
  path_c_revert_20261016120000)
    echo "▶ Path C: revert erroneous 20261016120000 history row (schema probes must be false)."
    supabase migration repair --status reverted 20261016120000 --db-url "$DB_URL" --yes
    ;;
  *)
    echo "::error::Unknown PROD_MIGRATION_REPAIR_MODE: $MODE" >&2
    exit 1
    ;;
esac

echo "✅ Prod migration repair ($MODE) complete."
