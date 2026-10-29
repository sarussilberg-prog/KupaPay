# Testing policy (KupaPay)

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
| Device UI | `apps/mobile/.maestro/device-ui/` | Login, layout probes, settle flows (CI) |

### Layout probes (Maestro)

When `EXPO_PUBLIC_E2E_MAESTRO_AUTH=true`, the app exposes zero-size testIDs after `onLayout` validates geometry:

- `group-card-full-width-ok` — card shell ≥ screen width minus list padding.
- `groups-create-btn-layout-ok` — create label fully inside the pill.

Maestro flows **fail** if these probes never appear (`assert-layout-probes.yaml`).

### Modal stacking

Use `expectAtMostOneVisibleModal` from `__tests__/helpers/modalTestUtils.tsx` for any sheet/dialog flow. Friend breakdown + cross-settle must never show two visible `Modal`s (iOS nested modal bug class).

## CI

See [CI_CD.md](./CI_CD.md) — **Mobile device UI (Maestro iOS/Android)** on path-scoped PRs.

## Adding a test for your fix

1. Reproduce the failure mode in a test name (e.g. “at most one visible Modal after settle-all”).
2. Implement the minimal assertion; avoid snapshot tests for layout.
3. For RTL row regressions, extend `nativeRowLayoutStyle.test.ts` or `rtlRowFlexSafety.test.ts` instead of duplicating ad hoc checks.
