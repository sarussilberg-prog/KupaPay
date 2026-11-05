# Testing policy (KupaPay)

## PR structure gate (required CI)

Every PR to `dev` / `main` must use [`.github/pull_request_template.md`](../.github/pull_request_template.md). Job **PR structure gate** (rolled into **CI gate**) enforces:

| Section | Requirement |
|---------|-------------|
| **Implementation** | What changed and why (substantive text, not placeholders). |
| **Tests** | Lists every **automated test file** changed in the diff (paths in backticks). App changes under `cost-share-app/apps/` or `cost-share-app/packages/` require test file changes unless the PR has label `no-tests-needed` **and** a body line `No tests needed: <reason>`. Docs-only PRs (`docs/**`, root `*.md`) are exempt. |
| **Proof** | How tests catch the regression. For **bug-fix** PRs (`bug` label or `fix:` / `fix(scope):` title), CI runs **red/green**: checkout merge-base, overlay only the new/changed test files, expect **FAIL**; then run on PR head and expect **PASS**. Summarized in the job summary. |
| **Spec** | Touch a **central spec doc** (below) **or** include `Spec: no change needed - <reason>` in the PR body. |

**Central spec docs** (any change satisfies Spec):

- `docs/SSOT/**` — SRS, CODE QUALITY, KNOWN_ISSUES, etc.
- `docs/TESTING.md` (this file)
- `docs/CI_CD.md`
- `docs/superpowers/specs/**`

Validator implementation: [`cost-share-app/scripts/lib/pr-structure-gate.mjs`](../cost-share-app/scripts/lib/pr-structure-gate.mjs) (unit tests in [`cost-share-app/scripts/__tests__/pr-structure-gate.test.mjs`](../cost-share-app/scripts/__tests__/pr-structure-gate.test.mjs)).

**Dependabot** PRs authored by `dependabot[bot]` that only change lockfiles or `.github/workflows/` / `dependabot.yml` are exempt.

## Regression rule (mandatory)

**Every bug fix must ship with at least one automated regression test that would have failed before the fix.**

- Prefer the layer closest to the failure:
  - **Device layout / taps** → Maestro assertions (layout probes + state checks), not screenshots alone.
  - **React tree / modal stacking / button handlers** → React Native Testing Library (RNTL).
  - **Pure layout/style rules** → Jest tests against the native row style resolver (`lib/nativeRowLayoutStyle.ts`) and architecture scans (`__tests__/architecture/`).
- Screenshots and manual QA are supplementary; they do **not** satisfy this rule by themselves.

Document new tests in the PR body: *what each test asserts* and *which bug it would catch*.

## Mobile layers

| Layer | Location | Purpose |
|-------|----------|---------|
| Unit / component | `apps/mobile/__tests__/` | RNTL, style resolver, i18n keys |
| Architecture | `apps/mobile/__tests__/architecture/` | Forbidden native RTL + flex patterns |
| RTL row migration guard | `apps/mobile/__tests__/guards/rtlRowPatterns.guard.test.ts` | Bans new `row-reverse` / hardcoded `direction: ltr|rtl` outside `hooks/useRtlLayout.tsx`; allowlist in `rtlRowPatterns.allowlist.json` must match the repo exactly (stale or unlisted entries fail). Refresh via `npx tsx apps/mobile/scripts/lib/refreshRtlRowAllowlist.ts`. Bad fixture: `__tests__/guards/fixtures/rtlRowBadFixture.tsx`. |
| E2E pseudo-locale guard | `apps/mobile/__tests__/guards/e2eXxLongLocaleNotInProd.guard.test.ts` | `xx-long` (`EXPO_PUBLIC_E2E_XX_LONG_LOCALE`) must not appear in `eas.json` production env. |
| Device UI | `apps/mobile/.maestro/device-ui/` | Login, layout probes, settle flows (CI) |
| Maestro CI planner | `cost-share-app/scripts/lib/maestro-ci-plan.mjs` | Tier + flow list for device UI workflows |
| Screen → flow map | `cost-share-app/scripts/lib/maestro-screen-flow-map.mjs` | Path-based extra flows on dev PRs |
| Maestro workflow lint | `cost-share-app/scripts/__tests__/github-maestro-workflows.test.mjs` | Job-level env / Sentry / ccache invariants for Maestro YAML |
| Release launch smoke | `apps/mobile/scripts/ci-release-launch-smoke.sh`, `apps/mobile/scripts/ci-maestro-device-ui.sh` (`PHASE=build` uses Gradle `assembleRelease` on CI), planner [`launch-smoke-ci-plan.mjs`](../cost-share-app/scripts/lib/launch-smoke-ci-plan.mjs), Maestro jobs `launch-smoke-ios` / `launch-smoke-android` | Cached Release `.app`/APK launches and stays alive 30s; infra-only PRs that touch these scripts run smoke on both platforms. See [release-launch-smoke spec](./superpowers/specs/2026-11-02-release-launch-smoke.md). Tests: [`launch-smoke-ci-plan.test.mjs`](../cost-share-app/scripts/__tests__/launch-smoke-ci-plan.test.mjs), [`releaseLaunchSmoke.guard.test.ts`](../cost-share-app/apps/mobile/__tests__/guards/releaseLaunchSmoke.guard.test.ts). |
| AWS Device Farm (manual) | `.github/workflows/device-farm-real-devices.yml` | `workflow_dispatch` only; gated on `DEVICE_FARM_ENABLED`; see [AWS Device Farm setup](./superpowers/specs/2026-11-02-aws-device-farm-setup.md) |

### Layout probes (Maestro)

When `EXPO_PUBLIC_E2E_MAESTRO_AUTH=true`, the app exposes zero-size testIDs after `onLayout` validates geometry:

- `group-card-full-width-ok` — card shell ≥ screen width minus list padding.
- `groups-create-btn-layout-ok` — create label fully inside the pill.

Maestro flows **fail** if these probes never appear (`assert-layout-probes.yaml`).

### Modal stacking

Use `expectAtMostOneVisibleModal` from `__tests__/helpers/modalTestUtils.tsx` for any sheet/dialog flow. Friend breakdown + cross-settle must never show two visible `Modal`s (iOS nested modal bug class).

## CI

See [CI_CD.md](./CI_CD.md) — **Mobile device UI (Maestro iOS/Android)** on path-scoped PRs.

### Maestro CI tiers (screen → flow mapping)

Dev PRs run **smoke** flows plus **affected** flows derived from changed files under `cost-share-app/apps/mobile/`. Mapping is defined in [`maestro-screen-flow-map.mjs`](../cost-share-app/scripts/lib/maestro-screen-flow-map.mjs) (unit tests: [`maestro-screen-flow-map.test.mjs`](../cost-share-app/scripts/__tests__/maestro-screen-flow-map.test.mjs)).

| Screen / area (source path) | Extra Maestro flows |
|-----------------------------|---------------------|
| `screens/auth/LoginScreen.tsx`, `components/auth/LoginE2EPasswordAuth.tsx` | `sign-in.yaml`, `locale-strings-login.yaml`, `assert-layout-probes.yaml` |
| `screens/groups/GroupsListScreen.tsx`, `components/GroupCard.tsx`, `components/groups/*` | `assert-groups-layout.yaml`, `main-layout.yaml`, layout probes |
| `screens/activity/ActivityFeedScreen.tsx` | `visit-main-screens.yaml`, `main-layout.yaml` |
| `screens/favoriteGroup/FavoriteGroupScreen.tsx` | `visit-main-screens.yaml`, `main-layout.yaml` |
| `screens/expenses/AddExpenseScreen.tsx` (prefix `screens/expenses/`) | `visit-main-screens.yaml`, `main-layout.yaml` |
| `screens/profile/ProfileScreen.tsx`, `components/dashboard/Friend*Sheet.tsx` | `profile-friend-breakdown.yaml`, `main-layout.yaml` |
| `components/navigation/CustomTabBar.tsx` | `visit-main-screens.yaml`, `main-layout.yaml` |
| `hooks/useRtlLayout.tsx` | `main-layout.yaml`, `profile-friend-breakdown.yaml`, `rtl-main-screens-tour-en/he.yaml` |
| `screens/profile/SettingsScreen.tsx` | `rtl-main-screens-tour-en/he.yaml`, `set-app-language.yaml` (pops Settings after language pick so `xx-long` without RTL reload still reaches tab bar) |

**Smoke baseline (always on dev):** `sign-in.yaml`, `assert-layout-probes.yaml`, `visit-main-screens.yaml` (English).

**Full tier (`main`, label `maestro-full`, or manual dispatch):** all flows in [`fullFlowRuns()`](../cost-share-app/scripts/lib/maestro-screen-flow-map.mjs) on **iOS and Android**, including RTL screenshot tours (`rtl-main-screens-tour-en/he`, paywall via `rtl-paywall-screenshot.yaml` + `e2e-fixture?screen=pro-paywall`) and Playwright RTL export checks (`e2e/expo-web-rtl-layout.spec.ts`).

Planner tests: [`maestro-ci-plan.test.mjs`](../cost-share-app/scripts/__tests__/maestro-ci-plan.test.mjs).

## Adding a test for your fix

1. Reproduce the failure mode in a test name (e.g. “at most one visible Modal after settle-all”).
2. Implement the minimal assertion; avoid snapshot tests for layout.
3. For RTL row regressions, extend `nativeRowLayoutStyle.test.ts` or `rtlRowFlexSafety.test.ts` instead of duplicating ad hoc checks.
