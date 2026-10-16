# Google Play Internal — GitHub Actions (manual)

Workflow: [`.github/workflows/play-internal.yml`](../.github/workflows/play-internal.yml)

Runs on **workflow_dispatch** only. Builds KupaPay Android (`cost-share-app/apps/mobile`, Expo SDK 54) with **EAS cloud** `eas build --platform android --profile production`, then uploads to the **Internal testing** track via `eas submit` (`eas.json` → `submit.production.android.track: internal`). This path does **not** submit for production review.

## Required repository secrets

Configure under **GitHub → Settings → Secrets and variables → Actions → Repository secrets**.

| Secret | Description |
|--------|-------------|
| `EXPO_TOKEN` | Expo access token for `@saussilberg/kupapay` ([Expo access tokens](https://expo.dev/accounts/saussilberg/settings/access-tokens)). |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Full JSON for the Play Console service account (same file as local `google-play-service-account.json` next to `eas.json`). |

## Optional / conditional secrets

| Secret | Description |
|--------|-------------|
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | RevenueCat Android public SDK key (`goog_…`). **Required when workflow input `pro_enabled` is true** — the workflow fails loud if missing. |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for source map upload during the EAS build. When unset, `app.config.ts` disables auto-upload. |
| `SENTRY_ORG` | Sentry organization slug (defaults in `app.config.ts` when token is set). |
| `SENTRY_URL` | Sentry instance URL (defaults in `app.config.ts` when token is set). |

## Workflow input

| Input | Default | Effect |
|-------|---------|--------|
| `pro_enabled` | `true` | Sets `EXPO_PUBLIC_KUPAPAY_PRO_ENABLED` for **this build only**. When `true`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` must be configured. |

## Version / versionCode

Marketing version comes from `packages/shared/version.json` via `app.config.ts`. **`versionCode`** is managed on EAS (`appVersionSource: remote` + production profile **`autoIncrement`**). The workflow does not commit version bumps.

**Live Production app:** `com.kupapay.mobile` is already on Production in Play Console — every upload must use a **`versionCode` higher than the current Production release** and the **existing EAS upload key** (see [PLAY_SETUP.md](PLAY_SETUP.md) §4).

## Build-time public env (this workflow)

In addition to EAS **production** environment variables (Supabase, Google OAuth, Sentry DSN, etc. — sync locally with `bash scripts/eas-sync-secrets.sh .env.production`):

| Variable | Set by workflow |
|----------|-----------------|
| `EXPO_PUBLIC_ADMOB_IOS_APP_ID` | Production iOS AdMob app id |
| `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` | Production Android AdMob app id |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | From secret when Pro enabled |

## Graceful skip

If `EXPO_TOKEN` or `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` is not configured, the workflow completes successfully with a notice and **does not** run EAS build or submit. This keeps CI green on forks and before Play Console is wired.

## Run

**Actions → Play Internal Android → Run workflow** → choose branch (usually `dev` or `main`) → set **pro_enabled** → Run.

After success, verify the release in Play Console → **Testing → Internal testing**. On-device checks: [PLAY_STORE_ANDROID.md §8](PLAY_STORE_ANDROID.md#8-on-device-smoke-test-after-internal-testing-install).

Related issue: [#159](https://github.com/sarussilberg-prog/KupaPay/issues/159) (Play setup).
