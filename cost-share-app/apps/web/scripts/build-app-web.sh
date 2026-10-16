#!/usr/bin/env bash
# Builds the Expo Web export for production (kupa-pay.com).
# Maps Vercel web env vars to Expo public env when needed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WEB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Committed defaults for CI/Vercel when dashboard env is unset (public anon key only).
# kupapay-dev Vercel project → always development Supabase (never kupa-pay.com prod DB).
# kupapay-prod / VERCEL_ENV=production → production; other previews → development.
# See docs/SSOT/SUPABASE_ENVIRONMENTS.md
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KUPAPAY_DEV_VERCEL_PROJECT_IDS=(
  "prj_ldRyqXhp9Gg0QAHCNzEBw3VIcWbc"
  "prj_wa5noNsRFK5797IRthACeREIa8jR"
)
IS_DEV_VERCEL_PROJECT=false
for id in "${KUPAPAY_DEV_VERCEL_PROJECT_IDS[@]}"; do
  if [[ "${VERCEL_PROJECT_ID:-}" == "$id" ]]; then
    IS_DEV_VERCEL_PROJECT=true
    break
  fi
done
if [[ "$IS_DEV_VERCEL_PROJECT" == true ]]; then
  DEFAULTS_FILE="$SCRIPT_DIR/supabase-public.development.defaults"
elif [[ "${VERCEL_ENV:-}" == "production" ]]; then
  DEFAULTS_FILE="$SCRIPT_DIR/supabase-public.production.defaults"
else
  DEFAULTS_FILE="$SCRIPT_DIR/supabase-public.development.defaults"
fi

for defaults_file in "$DEFAULTS_FILE"; do
  if [[ -f "$defaults_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$defaults_file"
    set +a
  fi
done

# Local-only override (never on Vercel). Committed apps/web/.env.production had prod keys
# and overwrote kupapay-dev preview — use supabase-public.*.defaults + dashboard env on CI.
if [[ -z "${VERCEL:-}" && "$IS_DEV_VERCEL_PROJECT" != true && -f "$WEB_DIR/.env.production" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$WEB_DIR/.env.production"
  set +a
fi


# Expo build; also accepts Next.js and Vercel Supabase integration variable names.
# Treat empty dashboard vars as unset so committed *.defaults are not wiped.
export EXPO_PUBLIC_SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-${SUPABASE_URL:-}}}"
if [[ -z "${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}" ]]; then unset NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; fi
if [[ -z "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ]]; then unset NEXT_PUBLIC_SUPABASE_ANON_KEY; fi
export EXPO_PUBLIC_SUPABASE_ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-${SUPABASE_PUBLISHABLE_KEY:-${SUPABASE_ANON_KEY:-}}}}}"

# Sentry (mobile dev project) — web export must embed DSN or SDK stays disabled.
export EXPO_PUBLIC_SENTRY_DSN="${EXPO_PUBLIC_SENTRY_DSN:-https://0687aa5ff4ed935fca55cbf504f18fc3@o4511495924023297.ingest.de.sentry.io/4511496059682896}"
export EXPO_PUBLIC_SENTRY_ENVIRONMENT="${EXPO_PUBLIC_SENTRY_ENVIRONMENT:-development}"
export EXPO_PUBLIC_GIT_COMMIT_SHA="${EXPO_PUBLIC_GIT_COMMIT_SHA:-${VERCEL_GIT_COMMIT_SHA:-}}"

# #376 — Email OTP only on dev Vercel projects (never prod project previews).
if [[ "$IS_DEV_VERCEL_PROJECT" == true ]]; then
  export EXPO_PUBLIC_ENABLE_EMAIL_AUTH=true
elif [[ -n "${VERCEL:-}" ]]; then
  unset EXPO_PUBLIC_ENABLE_EMAIL_AUTH
fi

if [[ -z "$EXPO_PUBLIC_SUPABASE_URL" || -z "$EXPO_PUBLIC_SUPABASE_ANON_KEY" ]]; then
  echo "Missing Supabase env vars in Vercel. Set any pair:" >&2
  echo "  URL: EXPO_PUBLIC_SUPABASE_URL | NEXT_PUBLIC_SUPABASE_URL | SUPABASE_URL" >&2
  echo "  Key: EXPO_PUBLIC_SUPABASE_ANON_KEY | NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | NEXT_PUBLIC_SUPABASE_ANON_KEY | SUPABASE_PUBLISHABLE_KEY | SUPABASE_ANON_KEY" >&2
  exit 1
fi

cd "$ROOT"
npm run build -w @cost-share/shared
npm run build:web -w @cost-share/mobile
