# KupaPay RTL layout audit & design (2026-11)

English-only doc. Scope: **Expo RN mobile** (`cost-share-app/apps/mobile`) and **Next.js web** (`cost-share-app/apps/web`).

---

## Phase 1 — Audit: how direction is decided at runtime

### App language vs device language

| Source | Role |
|--------|------|
| **AsyncStorage `@app_language`** | User-selected language; wins on startup (`i18n/index.ts` → `resolveStartupLanguage`). |
| **expo-localization** | Used only when no saved language; maps legacy codes (`iw` → `he`). |
| **Zustand `useAppStore().language`** | UI source of truth for `useAppLanguage()` / `useRtlLayout()`. |
| **i18next `i18n.language`** | Strings; kept in sync on `changeLanguage`. |

Seven mobile locales: `en`, `he`, `ar`, `de`, `es`, `fr`, `ru` (`@cost-share/shared`). RTL languages: **`he`, `ar`** (`RTL_LANGUAGES`).

### Native RTL: `I18nManager` + reload

File: `cost-share-app/apps/mobile/i18n/index.ts`

1. `I18nManager.allowRTL(true)` at module load.
2. `syncNativeRtl(language)` sets `I18nManager.forceRTL(RTL_LANGUAGES.has(language))`.
3. If `I18nManager.isRTL !== desired`, app **reloads** (`DevSettings.reload` in dev, `Updates.reloadAsync` in production) and persists `@rtl_native_applied`.
4. **Web:** `forceRTL` is called but layout uses DOM `dir` on the root view (`RtlLayoutProvider`).

**Known gap (KI-021):** Until reload completes, native mirroring can disagree with app language. UI must not pin `direction: 'ltr'` on rows when native is already RTL (root cause of #732).

### Expo / Android config

- `app.json` → `android.supportsRtl: true` (no `forcesRTL`; iOS relies on `I18nManager` + bundle localizations `he`, `en`).
- No Expo `supportsRTL` at root; Android manifest RTL comes from `supportsRtl`.

### Web (Next.js)

- `apps/web/app/layout.tsx`: `<html lang={locale} dir={rtl|ltr}>` from request locale.
- Marketing/legal islands set local `dir` (`LegalPage`, `AmbassadorProgramLanding`).
- Expo web export: `RtlLayoutProvider` sets `dir` on the root `View` when `Platform.OS === 'web'`.

---

## Helpers (mobile) — inventory

Canonical module: **`hooks/useRtlLayout.tsx`**

| Helper | Purpose |
|--------|---------|
| `useAppLanguage()` | Zustand → shared `Language`. |
| `useRtlLayout()` | `isRtlLanguage(app language)`; overridable via `RtlLayoutProvider` context (E2E). |
| `isNativeRtlSynced(isRtl)` | `I18nManager.isRTL === isRtl` (native only). |
| **`rtlRowStyle(isRtl)`** | **Single horizontal row style** — see Phase 2. |
| `rtlRootStyle(isRtl)` | App shell; **web** sets `direction`; **native** only `flex: 1` (no `direction`). |
| `rtlTextAlign` / `rtlWritingDirection` | Physical text edges / bidi. |
| `rtlTextClassName` | NativeWind alignment classes. |
| `resolveAutoTextStyle` / `resolveAutoTextInputStyle` / `resolveCompactTextInputStyle` | Text inputs without duplicate placeholders (iOS). |
| `rtlForwardChevronIcon(isRtl)` | Directional chevrons. |
| `feedActorNameStyle`, `centeredTextStyle`, `rtlTrailingAlign` | Feed / centered copy. |

Related:

| Module | Role |
|--------|------|
| `components/ui/iconLabelLayout.ts` | `listRowContainerStyle` = `rtlRowStyle` + gap. |
| `lib/nativeRowLayoutStyle.ts` | Group card inner row, flex safety checks. |
| `components/navigation/CustomTabBar.tsx` | Tab bar uses **`rtlRowStyle`** — Hebrew mirrors tab order (Groups leading/right, Profile trailing/left); Maestro checks `tabbar-groups-leftmost-rtl`. |
| `navigation/orderedTabBarRoutes.ts` | Route order; no row-reverse swap. |
| `lib/groupsLayoutDiagnostics.ts` | Real `onLayout` frames → Maestro/CI JSON checks. |
| `lib/scanRtlRowPatterns.ts` + guard test | Ban raw `row-reverse` / hardcoded `direction` outside allowlist. |

### Screens / components using row helpers (119 files touch `useRtlLayout` / `rtlRowStyle`)

High-traffic surfaces:

- **Groups:** `GroupCard`, `GroupsListHeader`, `GroupsListScreen`
- **Group detail:** `SummaryCover`, `SummaryFooter`, `SummaryBalanceStrip`, floating actions
- **Activity / feed:** `ActivityFeedScreen`, `ActivityItemCard`, `FeedRowCard`
- **Expenses:** `AddExpenseScreen`, expense v2 sheets/pills
- **Profile / settings:** `SettingsScreen`, `SettingsRow`, `LanguageSheet`, filters
- **Settle / paywall / login:** `SettleUpSheet`, pro sheets, `LoginScreen`
- **Navigation:** `CustomTabBar`

---

## Inconsistencies found (pre-fix baseline)

### P0 — Broken Hebrew mirror on device (#730–#732)

1. **`rtlRowStyle` set `direction: 'ltr'` on every native row** while `I18nManager.isRTL === true` after reload → Yoga **did not mirror** `flexDirection: 'row'` → GroupCard showed **avatar left, menu right** in Hebrew.
2. **Double compensation:** XOR `row-reverse` when app RTL ≠ `I18nManager`, but **plain `row` + `direction: ltr`** when equal → worst case for Hebrew.
3. **`rtlRootStyle` set `direction: rtl/ltr` on native root** — contributes to New Architecture flex shrink on nested rows (documented in `docs/diagnostics/groups-layout-2026-11.md`).

### P1 — Split brain: app RTL vs native RTL

- `useRtlLayout()` from language vs layout mirroring from `I18nManager` — must stay equal after reload; guards in `syncNativeRtl`.
- Tests that mocked `useRtlLayout(true)` **without** `I18nManager.isRTL = true` encoded the broken “always row-reverse” expectation.

### P2 — Former raw directional styles (resolved)

All **`rtlRowPatterns.allowlist.json` entries cleared** — row/direction hacks live only in `hooks/useRtlLayout.tsx` (`ltrAmountRowStyle`, `brandMarkAnimationWrapperStyle`, `rtlMarkdownContainerStyle`, etc.).

### Documented exceptions (canonical module only)

- **LTR amount rows:** `ltrAmountRowStyle` / `ltrAmountColumnStyle` (cancel I18nManager mirror for `$ 12.00`).
- **Brand logo animation:** `brandMarkAnimationWrapperStyle()` (web `direction: ltr`; native needs no pin after root fix).
- **Tab bar:** mirrors with `rtlRowStyle` — Hebrew places **Groups on the leading (right) edge**, Profile on trailing (left); Maestro checks `tabbar-groups-leftmost-rtl` / `tabbar-profile-rightmost-rtl`.

### P3 — Tests that did not catch device layout

| Test | Issue |
|------|--------|
| `useRtlLayout.test.ts` (old) | Asserted `direction: 'ltr'` + XOR row-reverse as **desired** behavior. |
| `SettingsRow` / `IconLabel` tests | Expected `row-reverse` for RTL without syncing `I18nManager`. |
| `groupsLayoutDiagnostics.test.ts` | Synthetic frames — valid for **evaluator** logic, not substitute for Maestro/Playwright geometry. |
| `E2eLayoutFixtureRoot` | Fixture tree without native reload — OK for strings, not for row geometry. |

---

## Phase 2 — Target design (industry-standard)

### Single source of truth

1. **Language → RTL flag:** `useRtlLayout()` only (from app language).
2. **Native layout mirroring:** `I18nManager.forceRTL` + **full app reload** on change; steady state **`I18nManager.isRTL === useRtlLayout()`**.
3. **Rows:** `flexDirection: 'row'` everywhere via **`rtlRowStyle()`** — no per-row `direction: 'ltr'|'rtl'` except **documented exceptions** (tab bar, LTR-only widgets).
4. **Pre-reload mismatch:** temporary **`row-reverse`** via `rtlRowStyle` until reload completes.
5. **Web:** `dir` on root (`RtlLayoutProvider` + Next `layout.tsx`); CSS logical properties in new web UI (`margin-inline-start`, etc.).
6. **Text:** `rtlTextAlign` / `writingDirection` / NativeWind `text-left` (flips in RTL) — avoid raw physical margins in StyleSheet.
7. **Directional icons:** `rtlForwardChevronIcon(isRtl)` (expand to arrows/back as needed).

### Language change UX

- Keep **`syncNativeRtl` reload** (already implemented).
- Settings should continue to treat reload as required for full native effect (KI-021: optional explicit alert — product copy already in `.cursor/rules/rtl.mdc`).

### Lint / guards (existing + rules)

| Guard | Location |
|-------|----------|
| No new `row-reverse` / literal `direction` | `__tests__/guards/rtlRowPatterns.guard.test.ts` + shrinking allowlist |
| No `marginLeft/Right` / `paddingLeft/Right` in styles | `rtlDirectionalLayout.guard.test.ts` |
| Native row + `direction:rtl` + flex | `rtlRowFlexSafety.test.ts` |
| IconLabel metrics | `iconLabel.guard.test.ts` |

**Rule for authors:** import row direction only from `rtlRowStyle`; never `flexDirection: isRtl ? 'row-reverse' : 'row'`.

---

## Phase 3 — Implementation status (this change set)

| Change | Status |
|--------|--------|
| Remove `direction: 'ltr'` from `rtlRowStyle` steady state | Done |
| Native `rtlRootStyle` without `direction` | Done |
| `isNativeRtlSynced`, `rtlForwardChevronIcon`, amount helpers | Done |
| Rewrite `useRtlLayout.test.ts` | Done |
| Fix component tests to sync `I18nManager` | Done |
| Migrate all former allowlist files (incl. tab bar) | Done — **allowlist empty** |
| `rtlDirectionalLayout` guard bans physical textAlign | Done |
| Tab bar mirrors in Hebrew (no `direction: ltr` pin) | Done — diagnostics updated |

**GroupCard (72pt row):** Children order remains avatar → text → balance → menu in JSX; with synced native RTL, **`rtlRowStyle` + I18nManager** mirrors to icon far **right**, menu far **left** in Hebrew.

---

## Phase 4 — Verification (real rendering)

| Platform | Mechanism | Locales |
|----------|-----------|---------|
| **iOS simulator** | Maestro: `rtl-main-screens-tour-en.yaml`, `rtl-main-screens-tour-he.yaml`, `assert-groups-layout-diagnostics-he.yaml` | en, he |
| **Android emulator** | Same Maestro flows when CI plan sets `run_android` | en, he |
| **Expo web** | Playwright `e2e/expo-web-rtl-layout.spec.ts` — **bounding boxes** on `group-card-probe-*` (B2 preview enables probe on first card) | en, he |
| **Next web** | Existing locale `dir` on `layout.tsx`; extend Playwright as needed | all marketing locales |

Screenshot artifact index: [`docs/rtl-screenshots/README.md`](rtl-screenshots/README.md).

CI workflows: `.github/workflows/mobile-device-ui-maestro.yml` (iOS + Android build/test), root `playwright.config.ts` includes `expo-web-rtl-layout`.

---

## References

- `docs/diagnostics/groups-layout-2026-11.md` — GroupCard flex investigation
- `docs/SSOT/KNOWN_ISSUES.md` KI-021 — reload after language change
- `docs/SSOT/UI_QUALITY_PLAN.md` — RTL guard migration plan
- `cost-share-app/.cursor/rules/rtl.mdc` — author rules (NativeWind)
