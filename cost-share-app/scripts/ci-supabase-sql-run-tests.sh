#!/usr/bin/env bash
# Run SQL __tests__ against an already-bootstrapped Supabase Postgres container.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/ci-supabase-sql-lib.sh
source "$ROOT/scripts/ci-supabase-sql-lib.sh"

if ! postgres_container_running; then
  echo "::error::Postgres container ${PG_CONTAINER} is not running — run ci-supabase-sql-bootstrap.sh first"
  exit 1
fi

files=(supabase/__tests__/*.test.sql)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "::error::no SQL tests found"
  exit 1
fi

LOCAL_SKIP=(
  activity_events.test.sql
  get_group_pairwise_debts.test.sql
  admin_portal.test.sql
  delete_my_account.test.sql
  account_deletion_lifecycle.test.sql
  security_support_admin.test.sql
  group_friend_activity_events.test.sql
  profile_invite_token_acl.test.sql
  redeem_group_invite_atomic.test.sql
)

ran=0
skipped=0
echo "▶ Running SQL tests (transaction rollback)"
for f in "${files[@]}"; do
  base="$(basename "$f")"
  if [[ " ${LOCAL_SKIP[*]} " == *" ${base} "* ]]; then
    echo "▶ skip — ${base} (full run on development DB post-deploy)"
    skipped=$((skipped + 1))
    continue
  fi
  echo "▶ psql — ${base}"
  psql_docker_file "$f"
  ran=$((ran + 1))
done

echo "✅ SQL integration tests passed (${ran} files, ${skipped} skipped locally)"
