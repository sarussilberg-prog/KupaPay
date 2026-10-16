#!/usr/bin/env bash
# Optional: Lighthouse on locally built Next.js (no deploy). Non-blocking warnings only in CI job config.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

source apps/web/supabase-public.development.defaults
export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-${SUPABASE_URL:-https://drxfbicunusmipdgbgdk.supabase.co}}"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-${SUPABASE_ANON_KEY:-placeholder}}"

npm run build -w @cost-share/shared
npm run build -w @cost-share/web

SESSION_NAME="lighthouse-next-ci"
tmux -f /exec-daemon/tmux.portal.conf has-session -t "=$SESSION_NAME" 2>/dev/null || \
  tmux -f /exec-daemon/tmux.portal.conf new-session -d -s "$SESSION_NAME" -c "$ROOT/apps/web" -- "${SHELL:-bash}" -l

tmux -f /exec-daemon/tmux.portal.conf send-keys -t "$SESSION_NAME:0.0" 'npm run start -- --hostname 127.0.0.1 --port 3000' C-m

for _ in $(seq 1 60); do
  if curl -sf http://127.0.0.1:3000/ >/dev/null; then
    break
  fi
  sleep 2
done

npx --yes @lhci/cli@0.14.0 autorun --config=lighthouserc.cjs

tmux -f /exec-daemon/tmux.portal.conf send-keys -t "$SESSION_NAME:0.0" C-c

echo "✅ Lighthouse CI finished"
