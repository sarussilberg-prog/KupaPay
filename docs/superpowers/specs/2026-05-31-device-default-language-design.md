# Seed app language from device locale on first launch — design

**Date:** 2026-05-31
**Branch:** `fix/settle-up-date-picker` (spec only; implementation will land on its own branch)
**Status:** Draft, awaiting user review

## Goal

On a brand-new install, pick the app language from the phone's OS-level language setting instead of always defaulting to English. Hebrew device → Hebrew + RTL. Anything else (including unsupported languages) → English + LTR. Once seeded, the chosen language is persisted to AsyncStorage and behaves like a manual user choice — subsequent launches use the existing saved-language path unchanged.

## Why

`cost-share-app/apps/mobile/i18n/index.ts` currently hardcodes `'en'` as the initial i18next language and only changes it when AsyncStorage has a value (set by the in-app language switcher in settings). A Hebrew-speaking user installing the app for the first time sees English until they discover the language switcher and change it manually. Reading the device locale removes that friction for the common case while leaving the manual switch intact for users whose phone language differs from their app-language preference.

## Behavior

`initializeLanguage()` in `cost-share-app/apps/mobile/i18n/index.ts` runs once at app startup. Its decision tree becomes:

1. Read `@app_language` from AsyncStorage.
2. **If a valid saved value exists** (`'en'` or `'he'`) → apply it, sync RTL, update the Zustand store. This is the existing path. **No change.**
3. **If no saved value** (first launch ever, or the user cleared app storage):
   1. Read `Localization.getLocales()[0]?.languageCode` from `expo-localization`.
   2. Map: `'he'` → `'he'`. Anything else (including `undefined`, unsupported codes like `'fr'`, or an empty locales array) → `'en'`.
   3. Apply the chosen language via `i18n.changeLanguage()`.
   4. Update the Zustand store via `useAppStore.getState().setLanguage(chosen)`.
   5. Persist the chosen language to AsyncStorage under `@app_language` so the next launch takes the existing saved-language path.
   6. Compute the desired RTL state (`'he'` → `true`, `'en'` → `false`). Compare against `I18nManager.isRTL`. If they differ, call `I18nManager.forceRTL(desired)` and then `Updates.reloadAsync()` from `expo-updates`. The reload is what makes the native layout direction actually flip — without it the strings change but the layout stays as it was.
   7. If the desired RTL state already matches `I18nManager.isRTL`, no `forceRTL` call and no reload — the most common first-install case (English phone on a fresh install) takes this fast path.

The RTL check is symmetric. The non-obvious case it covers: user installs while their phone is Hebrew (RTL forced on natively), later changes their phone to English and clears app data. AsyncStorage is empty so we re-enter the seeding path, but `I18nManager.isRTL` may still be `true` from the previous lifetime since the native flag is not part of app data on all platforms. We need to force it back to LTR and reload in that case, otherwise the user gets English strings in an RTL layout.

### Flow summary

| Phone language | Saved value | App behavior on first launch |
|---|---|---|
| English (or any non-Hebrew) | — | Opens in English LTR. Saves `'en'`. No reload. |
| Hebrew | — | Briefly opens, saves `'he'`, forces RTL, reloads (~1s). After reload: Hebrew RTL via the existing saved-language path. |
| Any | `'en'` | Existing path. English LTR. Unchanged. |
| Any | `'he'` | Existing path. Hebrew RTL. Unchanged. |

## Dependencies to add

Install via Expo's version-pinned installer so they line up with SDK 54:

```bash
npx expo install expo-localization expo-updates
```

Both packages are first-party Expo modules. `expo-updates` is also the package used for OTA updates — adding it here doesn't commit the project to using OTA; we only call `Updates.reloadAsync()`.

## Code changes

Single file: `cost-share-app/apps/mobile/i18n/index.ts`.

Add imports:

```ts
import * as Localization from 'expo-localization';
import * as Updates from 'expo-updates';
```

Add a small helper next to the existing exports:

```ts
type SupportedLanguage = 'en' | 'he';

const resolveDeviceLanguage = (): SupportedLanguage => {
    const code = Localization.getLocales()[0]?.languageCode;
    return code === 'he' ? 'he' : 'en';
};
```

Modify `initializeLanguage()` so the `else` branch (no saved value) seeds from device locale instead of just logging. The existing happy path (saved value present) stays exactly as-is:

```ts
export const initializeLanguage = async (): Promise<void> => {
    try {
        const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);

        if (savedLanguage === 'en' || savedLanguage === 'he') {
            // existing path — unchanged
            await i18n.changeLanguage(savedLanguage);
            const isRTL = savedLanguage === 'he';
            if (I18nManager.isRTL !== isRTL) {
                I18nManager.forceRTL(isRTL);
            }
            useAppStore.getState().setLanguage(savedLanguage);
            console.log(`Language loaded from storage: ${savedLanguage}`);
            return;
        }

        // First launch — seed from device locale
        const deviceLanguage = resolveDeviceLanguage();
        await i18n.changeLanguage(deviceLanguage);
        useAppStore.getState().setLanguage(deviceLanguage);
        await AsyncStorage.setItem(LANGUAGE_KEY, deviceLanguage);
        console.log(`Language seeded from device locale: ${deviceLanguage}`);

        const desiredRTL = deviceLanguage === 'he';
        if (I18nManager.isRTL !== desiredRTL) {
            I18nManager.forceRTL(desiredRTL);
            await Updates.reloadAsync();
            // Execution stops here — the app reloads and re-enters via the saved-language path.
        }
    } catch (error) {
        console.error('Failed to initialize language:', error);
    }
};
```

Notes:

- The reload only fires when the current and desired RTL states differ. Fresh-install-on-English-phone hits the fast path (no reload).
- The `I18nManager.isRTL !== desiredRTL` check is the same shape as the existing saved-language path's check, so the two paths stay consistent.
- The saved-language path is left structurally intact so the diff is small and the existing behavior is provably unchanged.

### Not changed

- `changeLanguage()` (manual switch from settings UI) — unchanged.
- `getSavedLanguage()` — unchanged.
- The `i18n.init({ lng: 'en', ... })` default — unchanged. It only matters for the split-second before `initializeLanguage()` runs.
- `en.json` / `he.json` resources — unchanged.

## Tests

`cost-share-app/apps/mobile/__tests__/i18n/index.test.ts` (create if not present — check the existing test layout in `__tests__/` first; the project keeps tests in `__tests__/<area>/<filename>.test.ts`).

Mock `@react-native-async-storage/async-storage`, `expo-localization`, `expo-updates`, and `react-native`'s `I18nManager`. The cases to cover:

1. **Saved `'he'`** — `getItem` returns `'he'`. Asserts `i18n.changeLanguage('he')`, store set to `'he'`, no read of device locale, no `Updates.reloadAsync` call.
2. **Saved `'en'`** — symmetric to above with `'en'`.
3. **No saved value + device `'he'`** — `getItem` returns `null`, `Localization.getLocales()` returns `[{ languageCode: 'he' }]`. Asserts: `setItem('@app_language', 'he')`, `I18nManager.forceRTL(true)`, `Updates.reloadAsync()` called once.
4. **No saved value + device `'en'`** — Asserts: `setItem('@app_language', 'en')`, no `forceRTL` call, no `reloadAsync` call.
5. **No saved value + device `'fr'` (unsupported)** — Same expectations as case 4 (defaults to English).
6. **No saved value + `getLocales()` returns `[]`** — Same expectations as case 4 (`languageCode` is `undefined`, falls through to English).
7. **No saved value + device `'he'` + `I18nManager.isRTL === true` already** — Asserts: language is `'he'`, no `forceRTL` call, no `reloadAsync` call (fast path — RTL already matches).
8. **No saved value + device `'en'` + `I18nManager.isRTL === true`** — The "left over RTL from a prior install" case. Asserts: `setItem('@app_language', 'en')`, `I18nManager.forceRTL(false)` called, `Updates.reloadAsync()` called once.

No on-device E2E test. The reload behavior is straightforward enough that unit-level mock assertions are sufficient.

## Non-goals

- No language switcher UX changes. The existing settings-screen switcher continues to be the only way for a user to change language after first launch.
- No support for additional languages. The mapping is hardcoded to `'en' | 'he'`; adding more is a future change.
- No region/dialect handling. `'he-IL'` and `'he'` both resolve to `'he'` via `languageCode`. Same for English variants.
- No re-detection of device language on subsequent launches. Once seeded (or once the user has manually picked), the saved value is authoritative forever.
- No splash-screen or loading-state work to mask the reload flash. The reload happens before the app has rendered meaningful UI; the default Expo splash covers it.

## Open questions

- Confirm there's no existing `__tests__/i18n/` directory; if there is, match its file naming. (Quick `ls` during implementation.)
- Confirm `expo-updates` doesn't require additional native config beyond `npx expo install` for the bare reload-only use case on SDK 54. The Expo docs for v54 should be the source of truth (see `apps/mobile/AGENTS.md` — it points to `https://docs.expo.dev/versions/v55.0.0/`; verify against v54 since `package.json` pins `"expo": "~54.0.0"`).
