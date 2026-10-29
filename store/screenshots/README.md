# Store listing screenshots (iOS + Google Play)

Localized, benefit-led marketing frames for all **7 product locales** (`en`, `he`, `ru`, `ar`, `fr`, `es`, `de`). Captions live in [`store/asc/screenshot-captions.json`](../asc/screenshot-captions.json). **Hebrew and Arabic** use RTL layout in the capture UI (see `screenshotDemo/AscStoreListingFrame.tsx`).

Demo data only — no production Supabase. Per-locale group names live in `screenshotDemo/ascCaptureLocaleData.ts`. Capture stubs services, seeds React Query, and drives the **real** `AppNavigator` full-bleed below a caption band (≤18% height). Playwright uses a **430×932 logical viewport @ deviceScaleFactor 3** → 1290×2796 PNGs (Android: 360×640 @3 → 1080×1920).

Related: App Store prep [#409](https://github.com/sarussilberg-prog/KupaPay/issues/409), listing drafts [#62](https://github.com/sarussilberg-prog/KupaPay/issues/62) / [#155](https://github.com/sarussilberg-prog/KupaPay/issues/155).

## Outputs

| Platform | Path | Sizes |
|----------|------|--------|
| **App Store (iPhone)** | `store/screenshots/ios/<ascLocale>/` | `6.7` (1290×2796), `6.5` (1284×2778), `6.9` (1320×2868), `ipad` (2048×2732) |
| **Google Play (phone)** | `store/screenshots/android/<appLocale>/` | `phone` (1080×1920) |
| **App Review (IAP paywall)** | `store/asc/review-screenshots/paywall-<ascLocale>.png` | phone-only frame |

ASC locale codes (`en-US`, `ar-SA`, …) vs Play folder names (`en`, `ar`, …) are mapped in [`store/aso/locale-manifest.json`](../aso/locale-manifest.json).

Screens captured: `groups`, `balances`, `add-expense`, `simplified-debts`, `pro-currency` (see `screens` array in captions JSON).

## Regenerate (local or CI)

From repo root:

```bash
cd cost-share-app/apps/mobile

export EXPO_PUBLIC_ASC_SCREENSHOT_DEMO=true
export EXPO_PUBLIC_KUPAPAY_PRO_ENABLED=true
export EXPO_PUBLIC_WEB_APP_URL=https://kupa-pay.com
# Dev anon key — same as .env.example / CI (drxfbicunusmipdgbgdk only)
export EXPO_PUBLIC_SUPABASE_URL=https://drxfbicunusmipdgbgdk.supabase.co
export EXPO_PUBLIC_SUPABASE_ANON_KEY="<your-dev-anon-key>"

npm run capture:store-screenshots
```

This runs `expo export --platform web` then Playwright capture (`scripts/playwright/capture-store-screenshots.mjs`). Each PNG is the marketing headline plus a device frame showing the live Expo web app (not partial mock screens).

Optional env (faster local runs):

- `CAPTURE_ASC_LOCALES=en-US,he` — subset of ASC locale codes
- `CAPTURE_SKIP_IAP_REVIEW=1` — skip `store/asc/review-screenshots/` paywall PNGs

**Edit captions:** change strings under `captions` in `store/asc/screenshot-captions.json`, then re-run the command above. Keep claims factual (real features only — no invented ratings, user counts, or stats).

## Optional: Maestro on device (Play)

For raw device pixels (no marketing frame), see [`store/play/README.md`](../play/README.md) and `store/play/maestro/capture-screenshots.yaml`. Prefer the Playwright pipeline above for localized caption overlays.

## Upload policy

**Do not** upload from automation without owner approval. Manual copy into App Store Connect / Play Console, or use `asc-upload-screenshots.mjs` only in controlled release prep workflows.

## Sample check

```bash
test -f store/screenshots/ios/en-US/6.7/groups.png
test -f store/screenshots/android/en/groups.png
```
