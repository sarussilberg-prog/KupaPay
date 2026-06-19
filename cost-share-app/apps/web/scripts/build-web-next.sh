#!/usr/bin/env bash
# Builds the Next.js web app for Vercel (kupa-pay.com / dev.kupa-pay.com).
# Handles env var resolution: Vercel dashboard → supabase-public.*.defaults fallback.
# Works whether invoked from apps/web/ (Vercel root = apps/web) or from
# apps/mobile/ (legacy Vercel root = apps/mobile) — copies .next/ output
# back to the invocation directory when needed.
set -euo pipefail

INVOCATION_DIR="$PWD"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WEB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

KUPAPAY_DEV_VERCEL_PROJECT_ID="prj_W8uZeTmZW0rdAnxEr9ywqMvH5yb8"
if [[ "${VERCEL_PROJECT_ID:-}" == "$KUPAPAY_DEV_VERCEL_PROJECT_ID" ]]; then
  DEFAULTS_FILE="$WEB_DIR/supabase-public.development.defaults"
elif [[ "${VERCEL_ENV:-}" == "production" ]]; then
  DEFAULTS_FILE="$WEB_DIR/supabase-public.production.defaults"
else
  DEFAULTS_FILE="$WEB_DIR/supabase-public.development.defaults"
fi

if [[ -f "$DEFAULTS_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$DEFAULTS_FILE"
  set +a
fi

# Map Supabase integration variable names to Next.js public names (treat empty as unset).
if [[ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" ]]; then
  export NEXT_PUBLIC_SUPABASE_URL="${SUPABASE_URL:-}"
fi
if [[ -z "${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}" ]]; then
  export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${SUPABASE_PUBLISHABLE_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-${SUPABASE_ANON_KEY:-}}}"
fi

if [[ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" || -z "${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}" ]]; then
  echo "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY." >&2
  exit 1
fi

cd "$ROOT"
npm run build -w @cost-share/shared
npm run build -w @cost-share/web

# If the build was invoked from a different directory than apps/web (e.g., from
# apps/mobile when the Vercel project root is apps/mobile), copy the .next/
# output back so Vercel finds it at the project root.
if [[ "$INVOCATION_DIR" != "$WEB_DIR" ]]; then
  echo "Syncing .next/ from $WEB_DIR → $INVOCATION_DIR ..."
  rm -rf "$INVOCATION_DIR/.next"
  cp -r "$WEB_DIR/.next" "$INVOCATION_DIR/.next"
fi
