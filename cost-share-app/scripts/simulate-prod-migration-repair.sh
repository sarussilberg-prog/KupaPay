#!/usr/bin/env bash
# Simulate prod duplicate-version failure (main) then dev repair + db push.
# Requires Docker (Supabase Postgres 17 image). Does not touch remote projects.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MAIN_ROOT="${MAIN_ROOT:-/tmp/kupapay-main-migrations/cost-share-app}"
DEV_ROOT="${DEV_ROOT:-$ROOT}"

PG_CONTAINER="kupapay-prod-migration-sim"
PG_IMAGE="ghcr.io/supabase/postgres:17.6.1.136"
PG_PORT=54323
PGUSER=supabase_admin
DB_URL="postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/postgres?sslmode=disable"

docker_cmd() {
  if docker info >/dev/null 2>&1; then
    docker "$@"
  else
    sudo docker "$@"
  fi
}

psql_docker() {
  docker_cmd exec -e PGPASSWORD=postgres -i "$PG_CONTAINER" psql -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 "$@"
}

psql_postgres() {
  docker_cmd exec -e PGPASSWORD=postgres -i "$PG_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
}

psql_docker_file() {
  cat "$1" | psql_docker -f -
}

migration_version() {
  basename "$1" .sql | cut -d_ -f1
}

record_migration() {
  local file="$1"
  local ver name
  ver="$(migration_version "$file")"
  name="$(basename "$file" .sql | sed "s/^${ver}_//")"
  psql_docker -c "INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
    VALUES ('${ver}', '${name}', ARRAY[]::text[]);"
}

try_record_migration() {
  local file="$1"
  local ver name
  ver="$(migration_version "$file")"
  name="$(basename "$file" .sql | sed "s/^${ver}_//")"
  if psql_docker -c "INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
    VALUES ('${ver}', '${name}', ARRAY[]::text[]);" 2>/dev/null; then
    return 0
  fi
  return 1
}

cleanup() {
  docker_cmd rm -f "$PG_CONTAINER" 2>/dev/null || true
}
trap cleanup EXIT

if ! command -v docker >/dev/null 2>&1; then
  echo "::error::docker required"
  exit 1
fi

echo "▶ Postgres (${PG_IMAGE})"
docker_cmd rm -f "$PG_CONTAINER" 2>/dev/null || true
docker_cmd run -d --name "$PG_CONTAINER" --shm-size=1gb \
  -e POSTGRES_PASSWORD=postgres \
  -e JWT_SECRET=ci-local-jwt-secret-at-least-32-chars \
  -p "${PG_PORT}:5432" "$PG_IMAGE" >/dev/null

for _ in $(seq 1 60); do
  if docker_cmd exec -e PGPASSWORD=postgres "$PG_CONTAINER" psql -U "$PGUSER" -d postgres -c 'SELECT 1' >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "▶ Auth/storage bootstrap (CI-compatible)"
psql_postgres <<'SQL'
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  statements text[],
  name text
);
GRANT ALL ON TABLE supabase_migrations.schema_migrations TO supabase_admin;
SQL
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
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
SQL

SCHEMA_CORE_LINES=1038
echo "▶ Baseline schema.sql (${SCHEMA_CORE_LINES} lines)"
head -n "$SCHEMA_CORE_LINES" "$DEV_ROOT/supabase/schema.sql" | psql_docker -f -

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
  psql_docker_file "$DEV_ROOT/$patch"
done

echo "▶ Apply MAIN migrations (prod repo state) with version tracking"
shopt -s nullglob
main_files=("$MAIN_ROOT"/supabase/migrations/*.sql)
IFS=$'\n' main_sorted=($(printf '%s\n' "${main_files[@]}" | sort))
unset IFS

for f in "${main_sorted[@]}"; do
  base="$(basename "$f")"
  case "$base" in
    20261016120000_pro_trial_reminder_cron.sql|20261016120000_recurring_expenses.sql|20261016121000_*|20261016130000_*)
      echo "▶ skip (prod pending/failed batch) — ${base}"
      continue
      ;;
  esac
  echo "▶ main migration ${base}"
  psql_docker_file "$f"
  record_migration "$f"
done

echo "▶ prod-like partial apply: pro_trial SQL ran but history row collides on 20261016120000"
psql_docker_file "$MAIN_ROOT/supabase/migrations/20261016120000_pro_trial_reminder_cron.sql"
if try_record_migration "$MAIN_ROOT/supabase/migrations/20261016120000_pro_trial_reminder_cron.sql"; then
  echo "::error::Expected duplicate version 20261016120000 (prod deploy failure)"
  exit 1
fi
echo "✅ Reproduced duplicate version 20261016120000 on schema_migrations"

echo "▶ Path B repair: pro-trial SQL already applied; record dev version 20261016120500 only"
cd "$DEV_ROOT"
npx supabase migration repair --status applied 20261016120500 --db-url "$DB_URL" --yes

echo "▶ db push remaining DEV migrations (renamed files + tail)"
npx supabase db push --db-url "$DB_URL" --yes

echo "▶ Verify unique versions 20261016120000 / 20500 / 21500"
psql_docker -c "SELECT version, name FROM supabase_migrations.schema_migrations WHERE version LIKE '202610161%' ORDER BY version;"

echo "✅ Prod migration repair simulation succeeded"
