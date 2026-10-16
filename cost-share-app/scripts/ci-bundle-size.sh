#!/usr/bin/env bash
# Build web + Expo web export locally (no Vercel) and enforce size-limit budgets.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

source apps/web/supabase-public.development.defaults

export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-${SUPABASE_URL:-https://drxfbicunusmipdgbgdk.supabase.co}}"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-${SUPABASE_ANON_KEY:-placeholder}}"
export EXPO_PUBLIC_SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-$NEXT_PUBLIC_SUPABASE_URL}"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}"

echo "▶ Build shared package"
npm run build -w @cost-share/shared

echo "▶ Build Next.js site"
npm run build -w @cost-share/web

echo "▶ Export Expo web"
npm run build:web -w @cost-share/mobile

echo "▶ size-limit"
npm run size

echo "✅ Bundle size budgets passed"
