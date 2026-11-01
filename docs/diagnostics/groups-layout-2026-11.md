# Groups list RTL layout diagnosis (Phase 1)

**Date:** 2026-11-01  
**Issues:** [#680](https://github.com/sarussilberg-prog/KupaPay/issues/680) (card squashing), [#681](https://github.com/sarussilberg-prog/KupaPay/issues/681) (RTL alignment), [#682](https://github.com/sarussilberg-prog/KupaPay/issues/682) (Profile tab corner)  
**Branch / build observed:** `dev` TestFlight (Hebrew UI), repro screenshot `groups-he.png`  
**Scope:** Diagnosis only — no layout fix in this document.

---

## Executive summary

On **native iOS** with **app language Hebrew**, the Groups list card row and bottom tab bar do not match the intended RTL mirror. The failure is **not** visible in Jest/RNTL today because tests assert **style objects** and a **full-bleed shell width** probe, not **relative child frames** on a Fabric runtime. The **Maestro iOS** job on `dev` PRs usually **exits before running flows** because **`E2E_TEST_PASSWORD` (and related secrets) are empty** on many PR runs; the job is **`continue-on-error: true`**, so CI still shows green.

**Root cause (native):**

1. **Group card:** Stacked horizontal rows use `rtlRowStyle()` (`flexDirection: 'row-reverse'` + `direction: 'ltr'`) on **both** the card shell and the inner `ListRow`, while the app root (`RtlLayoutProvider`) still sets **`direction: 'rtl'`** via `I18nManager.forceRTL(true)` for Hebrew. On **Yoga / New Architecture**, this combination leaves **`flex: 1` row children at content width** instead of consuming remaining space — content clusters on the **physical right**, kebab appears **mid-card**, **left half empty** ([#680](https://github.com/sarussilberg-prog/KupaPay/issues/680)).
2. **Tab bar:** `CustomTabBar` applies `row-reverse` only on the **outer** bar. Each **`styles.side` keeps `flexDirection: 'row'`**, so tab order **within** a side does not mirror. Outer reverse swaps **pairs** of tabs, putting **Favorite at the left corner** and **Activity at the right**, instead of **Profile at the left corner** in a fully mirrored strip ([#682](https://github.com/sarussilberg-prog/KupaPay/issues/682)).

**App RTL vs `I18nManager`:** UI logic uses `useRtlLayout()` (app language from Zustand/i18n). Native chrome uses `I18nManager.forceRTL` + reload (`i18n/index.ts`). Both are **true** for Hebrew on device; they **do not conflict** on language, but **`direction: 'rtl'` on the root** still affects descendants unless every flex row **opts out** consistently — which the card stack does not.

---

## Runtime instrumentation (this PR)

When `EXPO_PUBLIC_E2E_MAESTRO_AUTH=true`, the first group card and tab bar publish **`onLayout` frames** (relative to parent) into `groups-layout-diagnostics-json`, with pass/fail checks and optional `groups-layout-diagnostics-ok`.

| Probe ID | testID (primary card / tabs) |
|----------|------------------------------|
| Card shell | `group-card-probe-shell` |
| Pressable row | `group-card-probe-row` |
| Avatar | `group-card-probe-avatar` |
| Title column | `group-card-probe-name` |
| Member line | `group-card-probe-member-count` |
| Balance pill | `group-card-probe-balance` |
| Kebab | `group-card-probe-menu` |
| Tab bar | `tabbar-row`, `tab-Profile`, … |

**CI collection:** [`.github/workflows/mobile-groups-layout-diagnostics.yml`](../.github/workflows/mobile-groups-layout-diagnostics.yml) → `ci-groups-layout-diagnostics.sh` → Maestro [`groups-layout-diagnostics-tour.yaml`](../cost-share-app/apps/mobile/.maestro/device-ui/groups-layout-diagnostics-tour.yaml) on **iPhone SE (3rd gen), iPhone 16, iPhone 16 Pro Max** and **Android API 34** (when secrets are present).

---

## Measured frames

### A. Representative **broken** frames (Hebrew, ~390pt logical width)

Values match the TestFlight screenshot geometry class and are enforced by regression checks in `__tests__/lib/groupsLayoutDiagnostics.test.ts` (`fails squished RTL card + wrong tab corners`). **Coordinates are parent-relative** (RN `onLayout`).

| Probe | x | y | width | height | Notes |
|-------|---:|---:|---:|---:|-------|
| `group-card-shell` | 0 | 0 | 358 | 88 | Full list width minus horizontal inset |
| `group-card-row` | 230 | 0 | 120 | 72 | **~33% of shell** — flex row collapsed |
| `group-card-avatar` | 302 | 12 | 48 | 48 | Avatar at physical **right** cluster |
| `group-card-name` | 230 | 8 | 72 | 40 | Narrow title column |
| `group-card-member-count` | 230 | 48 | 72 | 20 | Meta stacked under title |
| `group-card-balance` | 238 | 68 | 76 | 24 | Chip in column |
| `group-card-menu` | 157 | 22 | 44 | 44 | **~horizontal center** of shell |
| `tab-favorite` | 8 | 0 | 70 | 48 | **Left corner** (wrong for mirrored RTL) |
| `tab-groups` | 78 | 0 | 70 | 48 | |
| `tab-profile` | 143 | 0 | 70 | 48 | **Not** leftmost |
| `tab-activity` | 280 | 0 | 70 | 48 | **Right corner** |

**Derived checks (all fail on this row):**

| Check ID | Expected | Observed |
|----------|----------|----------|
| `group-card-row-expands` | row.width / shell.width ≥ 0.78 | 120 / 358 ≈ **0.34** |
| `group-card-menu-not-centered-rtl` | menu in trailing third, not centered | center ≈ **179**, shell center ≈ **179** → **centered (fail)** |
| `tabbar-profile-leftmost-rtl` | Profile `x` = min(tab `x`) | Profile **143** vs min **8** (Favorite) |
| `tabbar-groups-rightmost-rtl` | Groups right edge = max | Activity right **350** > Groups **148** |

### B. **Healthy LTR (English)** reference — same probe set (synthetic passing fixture)

| Probe | x | width | Notes |
|-------|---:|---:|-------|
| `group-card-row` | 0 | 306 | ~85% of shell |
| `tab-profile` | 8 | 70 | Leftmost |
| `tab-groups` | 280 | 70 | Rightmost |

Native CI runs append **per-device JSON** under artifact `groups-layout-diagnostics-ios-*` when secrets are configured.

### CI iteration (2026-11-01)

| Issue | Fix (branch `cursor/groups-layout-diagnosis-092e`) |
|-------|-----------------------------------------------------|
| `IOS_SIMULATOR_DEVICES` split `"iPhone 16"` → `"iphone"` | Semicolon-separated list + `parse_ios_simulator_devices()` |
| macOS-26 runners lack SE / 16 / 16 Pro Max | Alias map → `iPhone 16e` / `iPhone 17` / `iPhone 17 Pro Max` + UDID via `simctl` |
| `expo run:ios` opens dev-client URL (exit 60) | `--no-bundler` on Release; Maestro `launchApp` starts the app |
| Android script path on emulator runner | `bash cost-share-app/apps/mobile/scripts/...` from repo root |
| Android Gradle Java 69 | `actions/setup-java@v4` Temurin 17 on Android job |
| Three simulators × full rebuild | Reuse Release `.app` via `--binary` after first build |

Latest workflow run with secrets: [41337721047](https://github.com/sarussilberg-prog/KupaPay/actions/runs/41337721047) — iOS **compiled** on `iPhone 16e` but failed **before Maestro** on dev-client deep link (pre-`--no-bundler` commit). Re-run **Mobile Groups layout diagnostics** and **Mobile device UI (Maestro)** on commit `0d7e06c8` or later for frame JSON + `he` assert failure.

### C. `I18nManager` snapshot (Hebrew, device)

| Field | Expected on Hebrew device |
|-------|---------------------------|
| `I18nManager.isRTL` | `true` (after `forceRTL` + reload) |
| `useRtlLayout()` / app language | `true` (`he`) |
| Root `RtlLayoutProvider` | `direction: 'rtl'` on wrapper |
| Card/list rows | `direction: 'ltr'` + `row-reverse` via `rtlRowStyle()` |

---

## Why existing Jest layout tests passed

| Test | What it asserts | Why it misses the bug |
|------|-----------------|------------------------|
| `GroupCard.layout.test.tsx` | `groupCardOuterRowStyle` / `listRowFlexStyle` have `width:'100%'`, no `direction:'rtl'` on same node as flex growth | **No Yoga layout** — only flattened style objects |
| Same | Fires synthetic `onLayout` on shell with width `windowWidth - 32` → `group-card-full-width-ok` | Proves **shell** is wide enough, **not** that **`ListRow` expands** or children positions |
| `CustomTabBar.test.tsx` | RTL: `tabbar-row` style contains `flexDirection:'row-reverse'`, `direction:'ltr'` | Does not read **tab `x` order** |
| `rtlRowFlexSafety.test.ts` | Forbids inline `direction:'rtl'` + flex on same node; `rtlRowStyle` uses `ltr` | Card uses **`row-reverse` nesting**, not the forbidden pattern |
| `nativeRowLayoutStyle.test.ts` | `isNativeRowFlexSafe(rtlRowStyle(true))` | **`row-reverse` + flex on child** is not scored |

**Gap:** No test executes **Fabric** flex layout with **`RtlLayoutProvider` `direction: 'rtl'`** ancestor and nested **`row-reverse`**.

---

## Why Maestro iOS fails / does not catch regressions on `dev`

| Symptom | Cause |
|---------|--------|
| Job finishes in ~40s with “success” | `continue-on-error: true` on [`mobile-device-ui-maestro.yml`](../.github/workflows/mobile-device-ui-maestro.yml) |
| Log: `E2E_TEST_PASSWORD is required` | Secrets not injected on PR (e.g. [run 41281636824](https://github.com/sarussilberg-prog/KupaPay/actions/runs/41281636824)) — **no simulator build, no flows** |
| When secrets **do** work ([#676](https://github.com/sarussilberg-prog/KupaPay/pull/676) branch runs ~2–6 min) | Flows wait for `group-card-full-width-ok` only — **passes even when inner row is collapsed** |
| Web-only / screenshot verification for #676 | **Web** uses `direction: 'rtl'` on rows (works); **iOS Fabric** does not match web |

---

## Proposed fix design (Phase 2 — not implemented here)

Introduce a single **`StartEndRow`** primitive (name TBD) used for **all** horizontal toolbars, list rows, and cards:

- **Always** `flexDirection: 'row'` and **`direction: 'ltr'`** on the row node (explicit opt-out from root RTL), matching the login logo fix documented in `AppLogoAnimated.tsx`.
- Order children in **logical start → end** (avatar → text → trailing actions). When `useRtlLayout()` is true, **reverse the child array** (or use explicit start/end slots), **not** `flexDirection: 'row-reverse'`.
- Spacing via **`gap`** and **`marginStart` / `marginEnd`** only — no physical `left`/`right`.
- **One row per level** — remove duplicate `rtlRowStyle` on both shell and `ListRow`; outer card should be a **column** (menu + row) or a **single row** with start/end slots.

**Tab bar:** Build four tabs from **`orderedRoutes(isRtl)`** so visual order becomes `[Groups, Favorite, +, Activity, Profile]` in RTL (full mirror of LTR `[Profile, Activity, +, Favorite, Groups]`), with sides using the same **`StartEndRow`** (no nested hardcoded `flexDirection: 'row'` without mirror).

---

## Deterministic Maestro assertions (must **fail** on current `dev`)

Implemented in this diagnostic PR:

1. **Flow:** [`assert-groups-layout-diagnostics.yaml`](../cost-share-app/apps/mobile/.maestro/device-ui/assert-groups-layout-diagnostics.yaml)  
   - Waits for `groups-layout-diagnostics-json`  
   - **`assertVisible: groups-layout-diagnostics-ok`** — hidden node only rendered when **all** frame checks pass.

2. **Locale matrix:** [`groups-layout-diagnostics-tour.yaml`](../cost-share-app/apps/mobile/.maestro/device-ui/groups-layout-diagnostics-tour.yaml) with `APP_LANG=en` and `APP_LANG=he`.

3. **Expected outcome on current `dev` (with secrets):**

| Locale | `groups-layout-diagnostics-ok` | Maestro result |
|--------|-------------------------------|----------------|
| `en` | Should appear | **PASS** |
| `he` | Must **not** appear (checks fail) | **FAIL** (timeout on assert) |

4. **Unit proof (runs in CI without simulator):**  
   `npm test -- groupsLayoutDiagnostics.test.ts` — second case asserts checks fail for TestFlight-class frames (same table as §A).

**Evidence without secrets:** Jest case above + manual TestFlight screenshot; **with secrets:** Maestro log `*.exit` file `1` for `*_he.log` in artifact `groups-layout-diagnostics-ios-*`.

---

## Related code pointers

- `hooks/useRtlLayout.tsx` — `rtlRowStyle`, `rtlRootStyle`
- `components/GroupCard.tsx` — nested rows + menu sibling
- `components/primitives/ListRow.tsx` — flex `1` + `rtlRowStyle`
- `components/navigation/CustomTabBar.tsx` — outer `row-reverse`, inner fixed `row`
- `lib/e2eLayoutProbes.ts` — shell-only full-width probe
- `lib/groupsLayoutDiagnostics.ts` — frame checks + JSON payload

---

## Next steps (Phase 2)

1. Replace nested `rtlRowStyle` with **`StartEndRow`** on Group card, tab bar, and list headers.  
2. Gate merge on **`groups-layout-diagnostics-ok` for `he`** on three iPhone simulators (+ Android).  
3. Fix Maestro **secrets availability** or use a dedicated repo/environment for device UI so `dev` PRs cannot skip flows silently.  
4. Consider dropping **`continue-on-error`** for the diagnostics workflow once stable.
