#!/usr/bin/env bash
# Vercel Ignored Build Step (ignoreCommand): exit 0 = skip build, exit 1 = build.
# Branch routing: kupa-*-dev projects → dev only; kupa-* prod → main only.
# Path routing: web vs mobile (arg or cwd) — skip when app + shared workspace unchanged.
set -euo pipefail

APP_KIND="${1:-}"
if [[ -z "$APP_KIND" ]]; then
  case "$(basename "$PWD")" in
    mobile) APP_KIND="mobile" ;;
    *) APP_KIND="web" ;;
  esac
fi

REF="${VERCEL_GIT_COMMIT_REF:-}"
MSG="${VERCEL_GIT_COMMIT_MESSAGE:-}"

if echo "$MSG" | grep -qiE '\[(skip ci|ci skip)\]'; then
  echo "Skipping Vercel build ([skip ci] in commit message)"
  exit 0
fi

KUPAPAY_DEV_VERCEL_PROJECT_IDS=(
  "prj_ldRyqXhp9Gg0QAHCNzEBw3VIcWbc"
  "prj_wa5noNsRFK5797IRthACeREIa8jR"
)

is_dev_project=false
for id in "${KUPAPAY_DEV_VERCEL_PROJECT_IDS[@]}"; do
  if [[ "${VERCEL_PROJECT_ID:-}" == "$id" ]]; then
    is_dev_project=true
    break
  fi
done

if [[ "$is_dev_project" == true ]]; then
  if [[ "$REF" != "dev" ]]; then
    echo "Dev Vercel project: skip (ref=${REF:-unknown}, want dev)"
    exit 0
  fi
else
  if [[ "$REF" != "main" ]]; then
    echo "Prod Vercel project: skip (ref=${REF:-unknown}, want main)"
    exit 0
  fi
fi

GIT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$GIT_ROOT" ]]; then
  echo "Not a git checkout — build"
  exit 1
fi

TO_SHA="${VERCEL_GIT_COMMIT_SHA:-HEAD}"
FROM_SHA="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [[ -z "$FROM_SHA" ]]; then
  FROM_SHA="$(git -C "$GIT_ROOT" rev-parse "${TO_SHA}^" 2>/dev/null || true)"
fi
if [[ -z "$FROM_SHA" ]]; then
  echo "No previous SHA — build"
  exit 1
fi

if [[ "$APP_KIND" == "mobile" ]]; then
  WATCH_PATHS=(
    cost-share-app/apps/mobile
    cost-share-app/packages/shared
    cost-share-app/package.json
    cost-share-app/package-lock.json
  )
else
  WATCH_PATHS=(
    cost-share-app/apps/web
    cost-share-app/packages/shared
    cost-share-app/package.json
    cost-share-app/package-lock.json
  )
fi

if git -C "$GIT_ROOT" diff --quiet "$FROM_SHA" "$TO_SHA" -- "${WATCH_PATHS[@]}"; then
  echo "No changes under ${WATCH_PATHS[*]} — skip"
  exit 0
fi

echo "Relevant changes detected — build"
exit 1
