#!/usr/bin/env bash
# Start Supabase Postgres Docker image and load schema/migrations (no SQL tests).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/ci-supabase-sql-lib.sh
source "$ROOT/scripts/ci-supabase-sql-lib.sh"

start_supabase_postgres_container

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

echo "▶ DB lints (Splinter-style, baseline-gated)"
bash scripts/ci-compare-db-lint-baseline.sh "$PG_CONTAINER" "$PGUSER"

echo "▶ SQL test auth helpers"
psql_docker <<'SQL'
CREATE OR REPLACE FUNCTION public.test_set_jwt_sub(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, TRUE);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user_id::text)::text, TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.test_set_authenticated(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.test_set_jwt_sub(p_user_id);
  PERFORM set_config('role', 'authenticated', TRUE);
END;
$$;
SQL

echo "✅ SQL CI bootstrap complete"
