#!/usr/bin/env bash
# SQL regression tests (Phase 0 Gate B).
# CI: Supabase Postgres 17 Docker (pg_net, auth, vault) + schema bootstrap.
# Each __tests__ file uses BEGIN/ROLLBACK — no persistent writes.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "::error::docker not found"
  exit 1
fi

PG_CONTAINER="kupapay-sql-ci-postgres"
PG_IMAGE="ghcr.io/supabase/postgres:17.6.1.136"
PG_PORT=54322
SCHEMA_CORE_LINES=1038
# supabase_admin is the bootstrap superuser in the Supabase Postgres image.
PGUSER=supabase_admin

psql_docker() {
  docker exec -e PGPASSWORD=postgres -i "$PG_CONTAINER" psql -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 "$@"
}

psql_docker_file() {
  local file="$1"
  cat "$file" | psql_docker -f -
}

cleanup() {
  docker rm -f "$PG_CONTAINER" 2>/dev/null || true
}
trap cleanup EXIT

echo "▶ Starting Postgres (${PG_IMAGE})"
docker rm -f "$PG_CONTAINER" 2>/dev/null || true
docker run -d --name "$PG_CONTAINER" \
  --shm-size=256mb \
  -e POSTGRES_PASSWORD=postgres \
  -e JWT_SECRET=ci-local-jwt-secret-at-least-32-chars \
  -e JWT_EXP=3600 \
  -p "${PG_PORT}:5432" \
  "$PG_IMAGE" >/dev/null

ready=0
for _ in $(seq 1 90); do
  if docker exec -e PGPASSWORD=postgres "$PG_CONTAINER" psql -U "$PGUSER" -d postgres -c 'SELECT 1' >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
if [[ "$ready" -ne 1 ]]; then
  echo "::group::Postgres container logs"
  docker logs "$PG_CONTAINER" 2>&1 | tail -80 || true
  echo "::endgroup::"
  echo "::error::Postgres did not accept connections"
  exit 1
fi

echo "▶ Auth schema compat (image drift)"
psql_docker <<'SQL'
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS banned_until timestamptz;

CREATE TABLE IF NOT EXISTS auth.sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
  user_id TEXT NOT NULL,
  session_id UUID,
  token TEXT,
  revoked BOOLEAN DEFAULT FALSE
);
ALTER TABLE auth.refresh_tokens ADD COLUMN IF NOT EXISTS session_id UUID;
ALTER TABLE auth.refresh_tokens ADD COLUMN IF NOT EXISTS token TEXT;
ALTER TABLE auth.refresh_tokens ADD COLUMN IF NOT EXISTS revoked BOOLEAN DEFAULT FALSE;

CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  public BOOLEAN DEFAULT FALSE
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS storage.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT REFERENCES storage.buckets (id),
  name TEXT
);

CREATE OR REPLACE FUNCTION storage.foldername(name TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT string_to_array(NULLIF(trim(both '/' FROM name), ''), '/');
$$;
SQL

echo "▶ Loading baseline schema.sql (core DDL, first ${SCHEMA_CORE_LINES} lines)"
head -n "$SCHEMA_CORE_LINES" supabase/schema.sql | psql_docker -f -

PATCH_FILES=(
  supabase/fix-rls-group-members-recursion.sql
  supabase/fix-is-group-member-anon-grants.sql
  supabase/get-user-dashboard.sql
  supabase/get-user-balance-summary.sql
  supabase/account-deletion-v2.sql
  supabase/account-deletion-v3-fixes.sql
  supabase/fix-profiles-account-deactivation.sql
  supabase/fix-groups-select-creator.sql
  supabase/friends-system.sql
  supabase/group-messages.sql
  supabase/invite-links.sql
  supabase/legal-documents.sql
  supabase/settle-up-v1.sql
)
for patch in "${PATCH_FILES[@]}"; do
  echo "▶ patch — $(basename "$patch")"
  psql_docker_file "$patch"
done

echo "▶ Applying incremental migrations"
shopt -s nullglob
migration_files=(supabase/migrations/*.sql)
IFS=$'\n' migration_files_sorted=($(printf '%s\n' "${migration_files[@]}" | sort))
unset IFS
for f in "${migration_files_sorted[@]}"; do
  echo "▶ migration — $(basename "$f")"
  psql_docker_file "$f"
done

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
  security_support_admin.test.sql
  group_friend_activity_events.test.sql
  profile_invite_token_acl.test.sql
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
