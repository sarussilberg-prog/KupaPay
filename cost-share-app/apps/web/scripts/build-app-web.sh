#!/usr/bin/env bash
# Builds the Expo Web export for production (kupa.pro).
# Maps Vercel web env vars to Expo public env when needed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

export EXPO_PUBLIC_SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}}"

if [[ -z "$EXPO_PUBLIC_SUPABASE_URL" || -z "$EXPO_PUBLIC_SUPABASE_ANON_KEY" ]]; then
  echo "Missing Supabase env vars. Set EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_* equivalents) in Vercel." >&2
  exit 1
fi

cd "$ROOT"
npm run build -w @cost-share/shared
npm run build:web -w @cost-share/mobile
