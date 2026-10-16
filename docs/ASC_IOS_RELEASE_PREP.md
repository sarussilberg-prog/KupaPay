# App Store Connect — iOS release prep (automated)

Manual workflow: [`.github/workflows/asc-ios-release-prep.yml`](../.github/workflows/asc-ios-release-prep.yml)

Uses the same secrets as [TestFlight iOS](TESTFLIGHT_GITHUB_ACTIONS.md): `ASC_API_KEY_*`, `EXPO_TOKEN`. **Does not submit for review.**

## What it does

1. **IAP metadata** — `store/asc/iap-metadata.json` → `scripts/asc-update-iap-metadata.mjs` (localizations, review notes, paywall review screenshot).
2. **Prices** — `scripts/asc-verify-iap-prices.mjs` checks ILS amounts against `expectedPriceILS`.
3. **Screenshots** — Maestro + simulator when possible; repo assets under `store/screenshots/ios/<locale>/{6.9,6.5,ipad}/`. Source captions: `store/asc/screenshot-captions.json`.
4. **Version** — `store/asc/whats-new.json` (SSOT `packages/shared/version.json`) → create/prepare version, attach latest **VALID** build, fill What's New.

## Local commands

From `cost-share-app/apps/mobile` (after `npm ci` at `cost-share-app`):

```bash
bash scripts/ci-write-asc-key.sh   # needs ASC_API_KEY_P8 in env
export ASC_API_KEY_ID=… ASC_API_KEY_ISSUER_ID=… ASC_API_KEY_PATH=./asc-api-key.p8

node scripts/generate-iap-review-screenshot.mjs
node scripts/asc-update-iap-metadata.mjs
node scripts/asc-upload-screenshots.mjs
node scripts/asc-prepare-app-version.mjs
node scripts/asc-report-status.mjs
```

**Screenshots:** `npx expo export --platform web` then `node scripts/playwright/capture-store-screenshots.mjs` (real UI via `?capture=1&screen=…&locale=…`). CI never uploads fallback/placeholder PNGs — the job fails if captures are missing.

Optional native path: EAS profile `asc-screenshots` + Maestro (no fallback).
