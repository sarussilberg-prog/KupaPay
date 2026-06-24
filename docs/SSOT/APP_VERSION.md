# App Version — Single Source of Truth

**The version literal lives only in `packages/shared/version.json`.**

## Consumers (all derive from that one file)
- `packages/shared/src/version.ts` exports `APP_VERSION` (re-exported from
  `@cost-share/shared`) → mobile `LoginScreen`, mobile `LegalDocumentSheet`,
  web `LegalPage`.
- `apps/mobile/app.config.ts` injects it into the Expo config `version` →
  the native build **and** `Constants.expoConfig.version` (mobile `SettingsScreen`).

`apps/mobile/app.json` has **no** `version` field; `app.config.ts` is the only place
that sets it (from the shared JSON).

## How it changes
- Push to `dev` → `bump-version-dev.yml` patch-bumps `packages/shared/version.json`.
- Merge to `main` → `bump-version-main.yml` minor-bumps and resets patch.
- Both workflows open and squash-merge their own bump PR.

## Store build numbers
`apps/mobile/eas.json` uses `appVersionSource: remote` with `autoIncrement`; EAS
manages store build numbers independently of this version string.

## Guardrail
`apps/mobile/__tests__/guards/ssot.guard.test.ts` fails CI if `app.json` regains a
version literal, `APP_VERSION` diverges from `version.json`, the old
`apps/mobile/version.json` reappears, a display stops using `APP_VERSION`, or a
bump workflow points at the old path.
