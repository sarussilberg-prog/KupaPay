#!/usr/bin/env bash
# Vercel Ignored Build Step (ignoreCommand): exit 0 = skip build, exit 1 = build.
# kupa-pay-dev / kupa-app-dev → dev branch only; kupa-pay / kupa-app (prod) → main only.
set -euo pipefail

REF="${VERCEL_GIT_COMMIT_REF:-}"
MSG="${VERCEL_GIT_COMMIT_MESSAGE:-}"

if echo "$MSG" | grep -qiE '\[(skip ci|ci skip)\]'; then
  echo "Skipping Vercel build ([skip ci] in commit message)"
  exit 0
fi

KUPAPAY_DEV_VERCEL_PROJECT_IDS=(
  "prj_W8uZeTmZW0rdAnxEr9ywqMvH5yb8"
  "prj_ldRyqXhp9Gg0QAHCNzEBw3VIcWbc"
)

is_dev_project=false
for id in "${KUPAPAY_DEV_VERCEL_PROJECT_IDS[@]}"; do
  if [[ "${VERCEL_PROJECT_ID:-}" == "$id" ]]; then
    is_dev_project=true
    break
  fi
done

if [[ "$is_dev_project" == true ]]; then
  if [[ "$REF" == "dev" ]]; then
    exit 1
  fi
  exit 0
fi

if [[ "$REF" == "main" ]]; then
  exit 1
fi
exit 0
