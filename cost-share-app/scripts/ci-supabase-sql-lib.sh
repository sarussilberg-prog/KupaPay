#!/usr/bin/env bash
# Shared helpers for local Supabase Postgres SQL CI (Docker).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=/dev/null
source "$ROOT/scripts/ci-supabase-versions.env"

PG_CONTAINER="${PG_CONTAINER:-kupapay-sql-ci-postgres}"
PG_IMAGE="$SUPABASE_POSTGRES_IMAGE"
PG_PORT="${PG_PORT:-54322}"
SCHEMA_CORE_LINES=1038
PGUSER=supabase_admin

psql_docker() {
  docker exec -e PGPASSWORD=postgres -i "$PG_CONTAINER" psql -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 "$@"
}

psql_docker_file() {
  local file="$1"
  cat "$file" | psql_docker -f -
}

remove_pg_container() {
  docker rm -f "$PG_CONTAINER" 2>/dev/null || true
}

postgres_container_running() {
  docker inspect -f '{{.State.Running}}' "$PG_CONTAINER" 2>/dev/null | grep -q '^true$'
}

# Supabase Postgres accepts connections before init scripts finish (auth/graphql missing).
wait_for_supabase_postgres_ready() {
  local max_attempts="${1:-120}"
  local attempt=0
  while (( attempt++ < max_attempts )); do
    if ! postgres_container_running; then
      sleep 2
      continue
    fi
    if ! docker exec "$PG_CONTAINER" pg_isready -U "$PGUSER" -d postgres -q 2>/dev/null; then
      sleep 2
      continue
    fi
    local status
    status="$(
      docker exec -e PGPASSWORD=postgres "$PG_CONTAINER" \
        psql -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 -tA <<'SQL' 2>/dev/null || true
SELECT CASE
  WHEN pg_is_in_recovery() THEN 'recovery'
  WHEN NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN 'no_auth'
  WHEN NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'graphql') THEN 'no_graphql'
  WHEN NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'graphql' AND p.proname = 'increment_schema_version'
  ) THEN 'no_graphql_fn'
  ELSE 'ready'
END;
SQL
    )"
    status="${status//$'\r'/}"
    if [[ "$status" == "ready" ]]; then
      echo "✅ Postgres ready (${PG_IMAGE}, attempt ${attempt})"
      return 0
    fi
    if (( attempt % 15 == 0 )); then
      echo "… waiting for Supabase Postgres init (${status}, attempt ${attempt}/${max_attempts})"
    fi
    sleep 2
  done
  echo "::group::Postgres container logs (readiness timeout)"
  docker logs "$PG_CONTAINER" 2>&1 | tail -120 || true
  echo "::endgroup::"
  echo "::error::Postgres did not become ready (auth/graphql/init)"
  return 1
}

start_supabase_postgres_container() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "::error::docker not found"
    return 1
  fi
  echo "▶ Starting Postgres (${PG_IMAGE})"
  remove_pg_container
  docker run -d --name "$PG_CONTAINER" \
    --shm-size=1gb \
    -e POSTGRES_PASSWORD=postgres \
    -e JWT_SECRET=ci-local-jwt-secret-at-least-32-chars \
    -e JWT_EXP=3600 \
    -p "${PG_PORT}:5432" \
    "$PG_IMAGE" >/dev/null
  wait_for_supabase_postgres_ready
}
