# TestFlight — GitHub Actions (manual)

Workflow: [`.github/workflows/testflight-ios.yml`](../.github/workflows/testflight-ios.yml)

Runs on **workflow_dispatch** only. Builds KupaPay iOS (`cost-share-app/apps/mobile`, Expo SDK 54) on a **macOS** runner with `eas build --local --platform ios --profile production`, then uploads to **TestFlight** via `eas submit` and an App Store Connect API key. This path does **not** submit the app for App Store review.

Apple Team ID used in CI: **HVW3H3DLRB** (also set in `app.json` → `ios.appleTeamId`).

## Required repository secrets

Configure under **GitHub → Settings → Secrets and variables → Actions → Repository secrets**.

| Secret | Description |
|--------|-------------|
| `EXPO_TOKEN` | Expo access token for `@saussilberg/kupapay` ([Expo access tokens](https://expo.dev/accounts/saussilberg/settings/access-tokens)). |
| `ASC_API_KEY_ID` | App Store Connect API key ID (e.g. `AuthKey_XXXXXX.p8` → the `XXXXXX` segment). |
| `ASC_API_KEY_ISSUER_ID` | App Store Connect API issuer UUID (Users and Access → Keys → Issuer ID). |
| `ASC_API_KEY_P8` | Full contents of the `.p8` private key file (single line or PEM with headers). Written to a temp file at build time; never committed. |

## Optional repository secrets

| Secret | Description |
|--------|-------------|
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | RevenueCat iOS public SDK key (`appl_…`). Passed into the build when set; omit if Pro is disabled for that run. |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for **source map upload** during the local EAS iOS build (`@sentry/react-native/expo` plugin). When unset, `app.config.ts` sets `SENTRY_DISABLE_AUTO_UPLOAD=true` and the build continues without uploading maps. |
| `SENTRY_ORG` | Sentry organization slug (e.g. `kupay-hb`). Used with the auth token; defaults to `kupay-hb` in `app.config.ts` if omitted but token is set. |
| `SENTRY_URL` | Sentry instance URL (e.g. `https://de.sentry.io/`). Matches the org region; defaults in `app.config.ts` when token is set. Project slug comes from `app.json` → `@sentry/react-native/expo` (`copay-mobile-prod` for production TestFlight builds). |

## Workflow input

| Input | Default | Effect |
|-------|---------|--------|
| `pro_enabled` | `true` | Sets `EXPO_PUBLIC_KUPAPAY_PRO_ENABLED` to `true` or `false` for **this build only** (does not change EAS project env). |

## Version / build number

Marketing version is unchanged. Before build, the workflow syncs EAS remote **iOS buildNumber** with the latest **VALID** build in App Store Connect (when possible), then `production` profile **`autoIncrement`** bumps for the new IPA. No git commits from this workflow.

## EAS environment (production)

Other `EXPO_PUBLIC_*` values (Supabase URL, Google client IDs, Sentry, etc.) should already live in the EAS **production** environment (sync locally with `bash scripts/eas-sync-secrets.sh .env.production` from `apps/mobile`). The workflow does not replace that sync.

## Run

**Actions → TestFlight iOS → Run workflow** → choose branch (usually `main`) → set **pro_enabled** → Run.

After success, wait for processing in App Store Connect → TestFlight. On-device checks: [APP_STORE_IOS.md §7](APP_STORE_IOS.md#7-on-device-smoke-test-testflight-install).

## Pro v2 smoke checklist (Phase 0 — Gate I)

Before promoting `EXPO_PUBLIC_KUPAPAY_PRO_ENABLED=true` on a production-bound build, complete once on a **dev / RC sandbox** TestFlight build and attach notes to the workflow run:

- [ ] Sign in (Google + Apple sample accounts)
- [ ] Paywall loads prices; Terms/Privacy links work
- [ ] Sandbox purchase → Pro unlocks export PDF
- [ ] Restore purchases
- [ ] Trip Pass purchase → group members see Pro (dev group)
- [ ] Webhook received (RC dashboard + `profiles.pro_until` row)
- [ ] Push token registered; test settle reminder still works
- [ ] Hebrew RTL: paywall + one Pro surface
- [ ] Offline: add expense still works; Pro surfaces degrade gracefully

**Build number sync:** The workflow fails loudly if `sync-eas-ios-build-number.mjs` errors (no `|| true`) so mis-versioned uploads are caught before EAS build.
