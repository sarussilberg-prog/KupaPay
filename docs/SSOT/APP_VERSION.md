# App Version — Single Source of Truth

**The version literal lives only in `packages/shared/version.json`.**

## Consumers (all derive from that one file)
- `packages/shared/src/version.ts` exports `APP_VERSION` (re-exported from
  `@cost-share/shared`) → mobile `LoginScreen`, mobile `LegalDocumentSheet`,
  web `LegalPage`, web `LandingFooter`.
- `apps/mobile/app.config.ts` injects it into the Expo config `version` →
  the native build **and** `Constants.expoConfig.version` (mobile `SettingsScreen`).

`apps/mobile/app.json` has **no** `version` field; `app.config.ts` is the only place
that sets it (from the shared JSON).

## How it changes
- Merge a PR to `dev` → the `ci.yml` **auto-merge** job patch-bumps
  `packages/shared/version.json` (a direct commit; exactly one bump per merge).
- Merge to `main` → `bump-version-main.yml` minor-bumps and resets the patch.

The dev bump lives **inside** the auto-merge job — not a separate push-triggered
workflow — because GitHub does not trigger workflows from `GITHUB_TOKEN` pushes, so
a push-triggered bump never fires after an auto-merge. No recursion: the bump is a
push to `dev`, and CI runs only on `pull_request`, so it cannot re-trigger itself.

## Store build numbers
`apps/mobile/eas.json` uses `appVersionSource: remote` with `autoIncrement`; EAS
manages store build numbers independently of this version string.

## Guardrail
`apps/mobile/__tests__/guards/ssot.guard.test.ts` fails CI if `app.json` regains a
version literal, `APP_VERSION` diverges from `version.json`, the old
`apps/mobile/version.json` reappears, a display stops using `APP_VERSION`, or the
version-bump automation (`ci.yml` / `bump-version-main.yml`) points at the old path.
