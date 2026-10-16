# App Version — Single Source of Truth

**Literals live in `cost-share-app/packages/shared/version.json`.**

| Field | Purpose |
|-------|---------|
| `version` | Internal identifier (on `dev`: `2.x.y-dev.N`; on `main` after release bump: clean semver) |
| `marketingVersion` | Store / native `CFBundleShortVersionString` (no `-dev` suffix) |
| `lastTestFlightInternalVersion` | Changelog baseline for the next TestFlight “What to Test” notes |

## Consumers

- `@cost-share/shared` exports `APP_VERSION`, `APP_MARKETING_VERSION`, build-info formatters, and Sentry release helpers.
- `apps/mobile/app.config.ts` injects **`marketingVersion`** into the native build; `Constants.expoConfig.version` matches the store string.
- In-app labels (Settings `AppBuildInfoFooter`, login, legal) use **`APP_VERSION`** (internal string).
- Sentry `release` / `dist` use **`APP_VERSION` + native build number** (mobile) or **`APP_VERSION` + Vercel git SHA** (web).

## Dev branch automation

Each squash-merge to `dev` (via `ci.yml` auto-merge) runs `cost-share-app/scripts/bump-dev-prerelease.mjs`:

1. Increments `-dev.N` in `version.json`.
2. Appends the merged PR title to root `CHANGELOG.md`.
3. Commits with **`[skip ci]`** and pushes to `dev` (no PR loop; Vercel `ignoreCommand` skips the deploy).

## Main / store releases

`bump-version-main.yml` (manual) bumps **`version` and `marketingVersion`** together on `main` (patch/minor/major). EAS still manages integer build numbers (`autoIncrement`).

## TestFlight

`.github/workflows/testflight-ios.yml` sets ASC **What to Test** from `CHANGELOG.md` entries since `lastTestFlightInternalVersion`, then updates that baseline (commit `[skip ci]`).

## Guardrail

`apps/mobile/__tests__/guards/ssot.guard.test.ts` fails CI if version SSOT or bump automation drifts.
