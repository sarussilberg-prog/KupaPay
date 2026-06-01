#!/usr/bin/env bash
# Build a Supabase pooler URL for `supabase db push` in CI (IPv4; URL-encodes password).
# Requires: SUPABASE_ENV (development|production) or SUPABASE_PROJECT_REF, SUPABASE_DB_PASSWORD
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=supabase-env.sh
source "$SCRIPT_DIR/supabase-env.sh"

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo "✗ SUPABASE_DB_PASSWORD is required" >&2
  exit 1
fi

ENCODED_PW="$(python3 -c "import urllib.parse, os; print(urllib.parse.quote(os.environ['SUPABASE_DB_PASSWORD'], safe=''))")"

case "$SUPABASE_PROJECT_REF" in
  drxfbicunusmipdgbgdk)
    POOLER_HOST="aws-1-ap-northeast-1.pooler.supabase.com"
    ;;
  jfqxjjjbpxbwwvoygahu)
    POOLER_HOST="aws-1-ap-northeast-2.pooler.supabase.com"
    ;;
  *)
    echo "✗ No pooler host mapped for project ref $SUPABASE_PROJECT_REF" >&2
    exit 1
    ;;
esac

printf 'postgresql://postgres.%s:%s@%s:5432/postgres\n' \
  "$SUPABASE_PROJECT_REF" "$ENCODED_PW" "$POOLER_HOST"
