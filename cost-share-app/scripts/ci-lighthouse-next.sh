#!/usr/bin/env bash
# Optional: Lighthouse on locally built Next.js (no deploy).
# Retries once on failure (cold start / LHCI flake). Score assertions are advisory in CI (see ci-performance.yml).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

source apps/web/supabase-public.development.defaults
export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-${SUPABASE_URL:-https://drxfbicunusmipdgbgdk.supabase.co}}"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-${SUPABASE_ANON_KEY:-placeholder}}"

npm run build -w @cost-share/shared
npm run build -w @cost-share/web

SESSION_NAME="lighthouse-next-ci"
LHCI="$ROOT/node_modules/.bin/lhci"

stop_server() {
  tmux -f /exec-daemon/tmux.portal.conf send-keys -t "$SESSION_NAME:0.0" C-c 2>/dev/null || true
}

start_server() {
  tmux -f /exec-daemon/tmux.portal.conf has-session -t "=$SESSION_NAME" 2>/dev/null || \
    tmux -f /exec-daemon/tmux.portal.conf new-session -d -s "$SESSION_NAME" -c "$ROOT/apps/web" -- "${SHELL:-bash}" -l
  tmux -f /exec-daemon/tmux.portal.conf send-keys -t "$SESSION_NAME:0.0" 'npm run start -- --hostname 127.0.0.1 --port 3000' C-m
  for _ in $(seq 1 60); do
    if curl -sf http://127.0.0.1:3000/ >/dev/null; then
      return 0
    fi
    sleep 2
  done
  echo "::error::Next.js server did not become ready on :3000" >&2
  return 1
}

run_lhci() {
  start_server
  "$LHCI" autorun --config="$ROOT/lighthouserc.cjs"
}

last_exit=0
for attempt in 1 2; do
  if run_lhci; then
    stop_server
    echo "✅ Lighthouse CI finished (attempt ${attempt})"
    exit 0
  fi
  last_exit=$?
  stop_server
  if [[ "$attempt" -eq 1 ]]; then
    echo "::warning::Lighthouse attempt 1 failed — retrying once after server restart"
    sleep 5
  fi
done

echo "::error::Lighthouse failed after 2 attempts (advisory in CI — see Lighthouse job; bundle size + query budgets still gate merges)" >&2
exit "$last_exit"
