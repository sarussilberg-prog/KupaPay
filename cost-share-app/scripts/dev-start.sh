#!/usr/bin/env bash
# Kupa dev launcher — preflight (non-interactive), then API + web in background + Expo in foreground.
#
# Usage (bash or npm run dev:start — safe from any cwd; not `sh`):
#   /path/to/cost-share-app/scripts/dev-start.sh
#   /path/to/cost-share-app/scripts/dev-start.sh --web-only
#   /path/to/cost-share-app/scripts/dev-start.sh --skip-tests
#   /path/to/cost-share-app/scripts/dev-start.sh --check-only
#
# Env: WEB_PORT=3001  API_PORT=3000

if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

export CI=1
export npm_config_yes=true
export npm_config_loglevel=error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

SERVER_DIR="$ROOT_DIR/apps/server"
WEB_DIR="$ROOT_DIR/apps/web"
MOBILE_DIR="$ROOT_DIR/apps/mobile"
SHARED_DIR="$ROOT_DIR/packages/shared"
SCRIPTS_DIR="$ROOT_DIR/scripts"

SERVER_ENV="$SERVER_DIR/.env"
WEB_ENV="$WEB_DIR/.env.local"
MOBILE_ENV="$MOBILE_DIR/.env"
VERIFY_SCHEMA_SH="$SCRIPTS_DIR/verify-supabase-schema.sh"
SCHEMA_SQL="$SERVER_DIR/db/schema.sql"

WEB_PORT="${WEB_PORT:-3001}"
API_PORT="${API_PORT:-3000}"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/.dev-logs}"

SKIP_CHECKS=false
SKIP_TESTS=false
WEB_ONLY=false
CHECK_ONLY=false
FORCE_INSTALL=false

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PIDS=()

usage() {
  sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
}

log()  { printf '%b▶%b %s\n' "$BLUE" "$NC" "$*"; }
ok()   { printf '%b✓%b %s\n' "$GREEN" "$NC" "$*"; }
warn() { printf '%b!%b %s\n' "$YELLOW" "$NC" "$*"; }
fail() { printf '%b✗%b %s\n' "$RED" "$NC" "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-checks)   SKIP_CHECKS=true ;;
    --skip-tests)    SKIP_TESTS=true ;;
    --web-only)      WEB_ONLY=true ;;
    --with-mobile)   WEB_ONLY=false ;; # legacy alias
    --check-only)    CHECK_ONLY=true ;;
    --install)       FORCE_INSTALL=true ;;
    -h|--help)       usage; exit 0 ;;
    *)               fail "Unknown option: $1 (try --help)" ;;
  esac
  shift
done

WITH_MOBILE=true
if [[ "$WEB_ONLY" == true ]]; then
  WITH_MOBILE=false
fi

load_api_port() {
  if [[ -f "$SERVER_ENV" ]]; then
    local p
    p="$(grep -E '^PORT=' "$SERVER_ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d ' "' || true)"
    [[ -n "$p" ]] && API_PORT="$p"
  fi
}

cleanup() {
  if [[ ${#PIDS[@]} -eq 0 ]]; then
    return
  fi
  echo ""
  log "Stopping background services..."
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      pkill -P "$pid" 2>/dev/null || true
    fi
  done
  wait "${PIDS[@]}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

is_placeholder() {
  local value="$1"
  [[ -z "$value" ]] && return 0
  [[ "$value" == *"YOUR-"* || "$value" == *"your-"* || "$value" == *"YOUR_"* ]]
}

port_in_use() {
  lsof -i ":$1" -sTCP:LISTEN -t >/dev/null 2>&1
}

# Stale Metro on 8081 forces Expo to 8082/8083; iOS simulator then keeps the wrong URL.
free_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti ":$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    warn "Freeing port $port (stale process)..."
    kill $pids 2>/dev/null || true
    sleep 0.5
  fi
}

free_metro_ports() {
  local p
  for p in 8081 8082 8083; do
    free_port "$p"
  done
}

# Free API/web/metro from a previous dev-start (Ctrl+C does not always stop background PIDs).
free_dev_stack_ports() {
  free_port "$API_PORT"
  free_port "$WEB_PORT"
  free_metro_ports
}

require_free_port() {
  local port="$1" label="$2"
  if port_in_use "$port"; then
    fail "$label port $port is still in use after cleanup. Stop the other process or change the port."
  fi
}

check_node() {
  log "Checking Node.js..."
  command -v node >/dev/null || fail "Node.js is not installed"
  local major
  major="$(node -p "process.versions.node.split('.')[0]")"
  [[ "$major" -ge 18 ]] || fail "Node.js 18+ required (found $(node -v))"
  ok "Node $(node -v)"
}

check_dependencies() {
  log "Checking dependencies..."
  if [[ "$FORCE_INSTALL" == true ]] || [[ ! -d "$ROOT_DIR/node_modules/@types/jest" ]]; then
    warn "Installing dependencies (npm install)..."
    (cd "$ROOT_DIR" && npm install --no-fund --no-audit)
  fi
  ok "node_modules ready"
}

env_example_path() {
  local file="$1"
  if [[ "$(basename "$file")" == ".env.local" ]]; then
    echo "$(dirname "$file")/.env.example"
  else
    echo "${file}.example"
  fi
}

check_env_file() {
  local label="$1" file="$2"
  shift 2
  local -a required=("$@")
  local example
  example="$(env_example_path "$file")"

  log "Checking $label env ($file)..."
  if [[ ! -f "$file" ]]; then
    if [[ -f "$example" ]]; then
      cp "$example" "$file"
      warn "$label: created $file from $(basename "$example") — add your Supabase credentials"
    else
      fail "$label: missing $file (no $(basename "$example") found)"
    fi
  fi

  local missing=()
  for key in "${required[@]}"; do
    local val
    val="$(grep -E "^${key}=" "$file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
    if is_placeholder "$val"; then
      missing+=("$key")
    fi
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    fail "$label: set these in $file: ${missing[*]}"
  fi
  ok "$label env"
}

check_env() {
  load_api_port
  check_env_file "Server" "$SERVER_ENV" \
    SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY
  check_env_file "Web" "$WEB_ENV" \
    NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if [[ "$WITH_MOBILE" == true ]]; then
    check_env_file "Mobile" "$MOBILE_ENV" \
      EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY
  fi
}

run_tsc() {
  local name="$1" dir="$2"
  log "Typecheck $name..."
  (cd "$dir" && npx tsc --noEmit)
  ok "Typecheck $name"
}

check_typescript() {
  run_tsc "shared" "$SHARED_DIR"
  run_tsc "server" "$SERVER_DIR"
  run_tsc "web" "$WEB_DIR"
}

check_shared_build() {
  log "Building @cost-share/shared..."
  (cd "$ROOT_DIR" && npm run build -w @cost-share/shared --silent)
  ok "Shared package build"
}

check_tests() {
  log "Running mobile unit tests (Jest)..."
  (cd "$ROOT_DIR" && npm test -w @cost-share/mobile -- --ci --passWithNoTests --silent)
  ok "Mobile tests passed"
}

run_checks() {
  echo ""
  echo "══════════════════════════════════════════"
  echo "  Kupa — preflight checks"
  echo "══════════════════════════════════════════"
  echo ""

  check_node
  check_dependencies
  check_env
  log "Checking Supabase schema..."
  bash "$VERIFY_SCHEMA_SH"
  ok "Supabase schema"
  check_typescript
  check_shared_build
  if [[ "$SKIP_TESTS" != true ]]; then
    check_tests
  else
    warn "Skipping tests (--skip-tests)"
  fi

  echo ""
  ok "All checks passed"
  echo ""
}

start_bg() {
  local name="$1"
  shift
  mkdir -p "$LOG_DIR"
  (cd "$ROOT_DIR" && "$@") >"$LOG_DIR/${name}.log" 2>&1 &
  local pid=$!
  PIDS+=("$pid")
  echo "  → $name  PID $pid  log: $LOG_DIR/${name}.log"
}

wait_for_port() {
  local port="$1" name="$2" logfile="$3" tries=30
  while [[ $tries -gt 0 ]]; do
    if port_in_use "$port"; then
      ok "$name listening on :${port}"
      return 0
    fi
    sleep 1
    tries=$((tries - 1))
  done
  warn "$name not ready — see $logfile"
  tail -15 "$logfile" 2>/dev/null || true
  return 1
}

start_background_stack() {
  free_dev_stack_ports
  require_free_port "$API_PORT" "API"
  require_free_port "$WEB_PORT" "Web"

  log "Starting shared package (watch)..."
  start_bg "shared" npm run dev -w @cost-share/shared --silent

  log "Starting API server..."
  start_bg "server" npm run dev -w @cost-share/server --silent

  log "Starting web app on port ${WEB_PORT}..."
  start_bg "web" npm run dev -w @cost-share/web -- -p "$WEB_PORT"

  log "Waiting for API and web..."
  wait_for_port "$API_PORT" "API" "$LOG_DIR/server.log" || true
  wait_for_port "$WEB_PORT" "Web" "$LOG_DIR/web.log" || true
}

start_expo_foreground() {
  echo ""
  echo "══════════════════════════════════════════"
  echo "  Expo — interactive (this terminal)"
  echo "══════════════════════════════════════════"
  echo "  w → web  |  a → Android  |  i → iOS simulator"
  echo "  iOS blank after i? → auto-reload runs; manual: npm run ios:open -w @cost-share/mobile"
  echo "  Metro: exp://127.0.0.1:8081"
  echo "  API: http://localhost:${API_PORT}/api  |  Web: http://localhost:${WEB_PORT}"
  echo "  Ctrl+C stops Expo and background services"
  echo ""

  # Foreground + TTY so w/a/i work; CI=1 only for preflight, not Expo UI.
  unset CI
  export EXPO_METRO_PORT=8081
  cd "$MOBILE_DIR"
  npm run start
}

start_services() {
  echo "══════════════════════════════════════════"
  echo "  Kupa — starting dev stack"
  echo "══════════════════════════════════════════"
  echo ""
  echo "  API:  http://localhost:${API_PORT}/api"
  echo "  Web:  http://localhost:${WEB_PORT}"
  LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')"
  if [[ -n "$LAN_IP" ]]; then
    echo "  Mobile API (set EXPO_PUBLIC_API_URL): http://${LAN_IP}:${API_PORT}/api"
  fi
  if [[ "$WITH_MOBILE" == true ]]; then
    echo "  Expo: interactive below (Metro ~8081)"
  else
    echo "  Logs: $LOG_DIR/"
  fi
  echo ""

  start_background_stack

  if [[ "$WITH_MOBILE" == true ]]; then
    start_expo_foreground
  else
    echo ""
    log "Tailing logs (Ctrl+C to stop)..."
    tail -f "$LOG_DIR"/*.log
  fi
}

# ─── Main ───────────────────────────────────────────────────────────────────

if [[ "$SKIP_CHECKS" != true ]]; then
  run_checks
else
  warn "Skipping preflight checks (--skip-checks)"
  load_api_port
fi

if [[ "$CHECK_ONLY" == true ]]; then
  ok "Check-only mode — not starting servers"
  trap - EXIT INT TERM
  exit 0
fi

start_services
