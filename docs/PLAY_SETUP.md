# Google Play setup — owner-only checklist (KupaPay Android)

Step-by-step tasks **only the Play Console / Google Cloud / RevenueCat account owner** can complete. Agents and CI must **not** spend money, create new signing keys, or ship to **Production** without your explicit approval.

Package: **`com.kupapay.mobile`** · Mobile root: `cost-share-app/apps/mobile` · Listing copy: [`store/play/`](../store/play/) · CI: [PLAY_INTERNAL_GITHUB_ACTIONS.md](PLAY_INTERNAL_GITHUB_ACTIONS.md)

---

## Current Play Console state (owner-confirmed)

| Item | Status |
|------|--------|
| Developer account | **Exists** — Personal, **sarussilberg**, account id `7243079991536393959` (no new registration or $25 fee). |
| Live app | **`com.kupapay.mobile`** — already on **Production** (last updated **26 Jul 2026**, ~13 installs). |
| Legacy draft | **`com.kupay.mobile`** — old draft; **ignore** (do not publish or migrate). |
| Payments profile | **Appears configured** — verify in Console; no need to create from scratch unless something is incomplete. |
| GitHub CI secret | **`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` is set** — service account **`eas-play-submit@kupa-496716.iam.gserviceaccount.com`** (Google Cloud project **`kupa-496716`**), same key used for **EAS submit** → [play-internal.yml](../.github/workflows/play-internal.yml). |
| Play API access | **Verify in Console** — **Setup → API access** should list the linked Cloud project; **Users and permissions** must grant this service account **Release manager** (or Admin) on **`com.kupapay.mobile`**. |
| Signing | Play App Signing + **existing upload key** on **EAS** — **must reuse**; never generate a new Android keystore for this app. |

---

## 1. Developer account (already done)

1. Sign in to [Google Play Console](https://play.google.com/console) as **sarussilberg** (Personal account above).
2. Keep identity / policy items current if Google prompts; **do not** register a second developer account for KupaPay.

---

## 2. Payments profile & merchant (verify)

1. Play Console → **Settings → Developer account → Payments profile**.
2. Confirm merchant status is active (tax, banking, country) so **subscriptions and IAP** can be sold.
3. Google Pay at checkout is handled by **Play Billing** — no separate Google Pay API in the app.

If anything is incomplete, finish it in Console only; agents do not configure merchant accounts.

---

## 3. App record — use existing `com.kupapay.mobile`

**Do not create a new app.** Open the existing **KupaPay** production app (`com.kupapay.mobile`).

1. **Ignore** the legacy draft **`com.kupay.mobile`**.
2. Complete or refresh mandatory **App content** using drafts in:
   - [`store/play/DATA_SAFETY_ANSWERS.md`](../store/play/DATA_SAFETY_ANSWERS.md)
   - [`store/play/CONTENT_RATING_ANSWERS.md`](../store/play/CONTENT_RATING_ANSWERS.md)
3. **Privacy policy URL:** `https://kupa-pay.com/legal/privacy` (production `legal_documents` published — [PLAY_STORE_ANDROID.md](PLAY_STORE_ANDROID.md) §0.1).
4. Upload or update listing text from `store/play/<locale>/` and graphics from `store/play/graphics/`.

---

## 4. versionCode & signing (critical for live Production)

The store already has production builds. Every new `.aab` must:

1. Use **`versionCode` strictly greater** than the **current Production** release (Play Console → **Release → Production** → open latest release → note **Version code**).
2. **Reuse EAS Android credentials** — same upload keystore EAS already uses for this project (`eas credentials -p android`). Do **not** run a fresh keystore generation or `expo prebuild` expecting a new signing identity.
3. Repo uses EAS **`appVersionSource: remote`** + production profile **`autoIncrement`**. Before the first submit after a long pause, confirm remote counter is ahead of Play:
   ```bash
   cd cost-share-app/apps/mobile
   eas build:version:get -p android
   ```
   If EAS remote `versionCode` ≤ Production in Console, bump remote (Expo docs: `eas build:version:set`) to **Production + 1** before building.

Marketing **version name** comes from `packages/shared/version.json` via `app.config.ts`.

---

## 5. Service account + API access (CI configured — verify Console)

**GitHub (done):** repository secret **`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`** holds the JSON for **`eas-play-submit@kupa-496716.iam.gserviceaccount.com`**. The [**Play Internal Android**](../.github/workflows/play-internal.yml) workflow writes it to `google-play-service-account.json` and runs `eas submit` (same path as local EAS submit).

**Owner verify (Play Console):**

1. **Setup → API access** — Cloud project **`kupa-496716`** (or equivalent) linked; service account visible with Play Developer API access.
2. **Users and permissions** — `eas-play-submit@kupa-496716.iam.gserviceaccount.com` invited with **Release manager** (or Admin) for **`com.kupapay.mobile`**.
3. If `eas submit` fails with permission errors, fix Console roles — do **not** create a second service account unless you rotate keys deliberately.

**Local / EAS:** copy the **same** JSON to `cost-share-app/apps/mobile/google-play-service-account.json` (**never commit**).

**Also required for CI:** **`EXPO_TOKEN`** ([Expo access tokens](https://expo.dev/accounts/saussilberg/settings/access-tokens)).

RevenueCat (§7) can reuse this JSON for Play product sync once linked in the RevenueCat dashboard.

**App Links / Google Sign-In:** If not already wired, copy **App signing key** SHA-1 / SHA-256 from **Setup → App signing** into Google Cloud OAuth (Android client) and Supabase `KUPAPAY_ANDROID_RELEASE_SHA256` — [PLAY_STORE_ANDROID.md](PLAY_STORE_ANDROID.md) §3.3.

---

## 6. In-app products (Play Console)

Create or verify products with these **exact IDs** (must match RevenueCat and the app):

| Product ID | Play type |
|------------|-----------|
| `kupapay_pro_monthly` | Subscription, base plan monthly |
| `kupapay_pro_yearly` | Subscription, base plan yearly |
| `kupapay_trip_pass` | One-time product **or** prepaid / non-renewing subscription (30-day Trip Pass) |

Set prices (VAT-inclusive).

**Free trial (owner decision):** attach a **14-day free trial** offer on the **base plan** for both monthly and yearly (not 7 days). Step-by-step: [`store/play/SUBSCRIPTION_OFFERS.md`](../store/play/SUBSCRIPTION_OFFERS.md).

**EU consumers:** do **not** add an in-app EU withdrawal waiver on Android — Play Billing handles purchase terms in Google’s UI. (iOS keeps a separate App Store acknowledgement where required.)

**Automation (optional):** [Google Play Developer API](https://developers.google.com/android-publisher) — available via the same service account once Console API access is confirmed.

---

## 7. RevenueCat (Google Play)

Follow [KUPAPAY_PRO_SETUP.md](KUPAPAY_PRO_SETUP.md), Android-specific:

1. RevenueCat → **Apps** → **Google Play** app `com.kupapay.mobile`.
2. Upload the same **Play service account JSON** (`eas-play-submit@…`) in RevenueCat (per their Play integration docs).
3. Map products to entitlement **`pro`** and offering **`default`** (`$rc_monthly`, `$rc_annual`, `trip_pass`).
4. **`EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`** (`goog_…`) → GitHub secret + EAS env (`eas-sync-secrets.sh`).
5. Webhook → Supabase `revenuecat-webhook` (iOS + Play, shared product ids).

---

## 8. Releases — Internal testing first (CI default)

**Production already exists** with real users (~13 installs). Agents and default CI still target **Internal testing** only (`eas.json` → `submit.production.android.track: internal`). **Do not** promote to Production from automation.

**Option A — GitHub Actions (recommended for pre-prod validation):**

1. Ensure **`EXPO_TOKEN`** is set (Play JSON secret is already configured).
2. **Actions → Play Internal Android → Run workflow** (`pro_enabled` as needed).
3. Confirm **`versionCode`** from §4 before/after build (`eas build:version:get -p android` in workflow logs).

**Option B — local:**

```bash
cd cost-share-app/apps/mobile
npm run eas:build:android
npm run eas:submit:android   # internal track unless you change profile deliberately
```

4. **Testing → Internal testing** → testers → smoke tests [PLAY_STORE_ANDROID.md §8](PLAY_STORE_ANDROID.md#8-on-device-smoke-test-after-internal-testing-install).
5. **Production promotion** is **owner-only**: Play Console → promote tested release when ready; never via cloud agent without explicit instruction.

---

## 9. Out of scope for automation

- Registering a new Play developer account or paying registration fees.
- Creating **`com.kupapay.mobile`** or publishing **`com.kupay.mobile`**.
- Generating a **new** Android upload/signing key (breaks updates to the live app).
- Promoting releases to **Production** or increasing rollout % without owner approval.
- Rotating or replacing the Play service account key without updating GitHub **`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`** and local `google-play-service-account.json`.

---

## 10. Quick reference

| Item | Value |
|------|--------|
| Developer account | Personal **sarussilberg**, id `7243079991536393959` |
| Package (live) | `com.kupapay.mobile` (Production) |
| Ignore | `com.kupay.mobile` (legacy draft) |
| Entitlement (RevenueCat) | `pro` |
| Subscription SKUs | `kupapay_pro_monthly`, `kupapay_pro_yearly` |
| Trip Pass SKU | `kupapay_trip_pass` |
| Android RC key env | `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` |
| Pro master flag | `EXPO_PUBLIC_KUPAPAY_PRO_ENABLED` |
| AdMob Android app id | `ca-app-pub-8860544182475196~8155234876` |
| Offer codes (Android) | Paywall → `https://play.google.com/redeem` |
| versionCode | Must exceed current **Production**; EAS remote + `autoIncrement` |
| Play submit service account | `eas-play-submit@kupa-496716.iam.gserviceaccount.com` |
| GitHub secret (Play JSON) | `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (configured) |
