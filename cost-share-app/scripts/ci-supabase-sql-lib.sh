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

# Supabase Postgres accepts connections before init scripts finish; the entrypoint also
# stops and restarts Postgres once after first-boot init ("database system is shutting down").
wait_for_supabase_postgres_ready() {
  local max_wait_secs="${1:-480}"
  local elapsed=0
  local stable_hits=0
  local last_note=0
  while (( elapsed < max_wait_secs )); do
    if ! postgres_container_running; then
      stable_hits=0
      sleep 2
      elapsed=$((elapsed + 2))
      continue
    fi
    if ! docker exec "$PG_CONTAINER" pg_isready -U "$PGUSER" -d postgres -q 2>/dev/null; then
      stable_hits=0
      sleep 2
      elapsed=$((elapsed + 2))
      continue
    fi
    local auth_ready
    auth_ready="$(
      docker exec -e PGPASSWORD=postgres "$PG_CONTAINER" \
        psql -U "$PGUSER" -d postgres -tA -c \
        "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth'" 2>/dev/null || true
    )"
    auth_ready="${auth_ready//$'\r'/}"
    if [[ "$auth_ready" == "1" ]]; then
      stable_hits=$((stable_hits + 1))
      if (( stable_hits >= 2 )); then
        echo "✅ Postgres ready (${PG_IMAGE}, ${elapsed}s)"
        return 0
      fi
      sleep 5
      elapsed=$((elapsed + 5))
      continue
    fi
    stable_hits=0
    sleep 2
    elapsed=$((elapsed + 2))
    if (( elapsed - last_note >= 30 )); then
      last_note=$elapsed
      echo "… waiting for Supabase Postgres init (${elapsed}s / ${max_wait_secs}s)"
    fi
  done
  echo "::group::Postgres container logs (readiness timeout)"
  docker logs "$PG_CONTAINER" 2>&1 | tail -120 || true
  echo "::endgroup::"
  echo "::error::Postgres did not become ready (auth schema / first-boot init)"
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
