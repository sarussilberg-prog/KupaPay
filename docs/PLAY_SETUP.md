# Google Play setup — owner-only checklist (KupaPay Android)

Step-by-step tasks **only the Play Console / Google Cloud / RevenueCat account owner** can complete. Agents and CI must **not** create paid developer accounts, merchant profiles, or production releases.

Package: `com.kupapay.mobile` · Mobile root: `cost-share-app/apps/mobile` · Listing copy: [`store/play/`](../store/play/) · CI: [PLAY_INTERNAL_GITHUB_ACTIONS.md](PLAY_INTERNAL_GITHUB_ACTIONS.md)

---

## 1. Google Play developer account

1. Open [Google Play Console](https://play.google.com/console).
2. Pay the **one-time $25** developer registration fee (if no account exists).
3. Complete **identity verification** and accept the Developer Distribution Agreement.
4. **Do not** roll out to **Production** until legal, Data safety, and content rating are complete.

---

## 2. Payments profile & merchant

1. Play Console → **Settings → Developer account → Payments profile**.
2. Link or create a **Google payments merchant** profile (required for paid apps/IAP).
3. Complete tax and banking details for **Israel** (or your entity country).
4. Enable **Google Play Billing** for the app (automatic when you create subscriptions/IAP).

Google Pay at checkout is handled by Play Billing — no separate Google Pay API setup in the app.

---

## 3. Create the app in Play Console

1. **Create app** → name **KupaPay**, default language **Hebrew** or **English**, app / game = App, free with IAP.
2. Note the package name must be **`com.kupapay.mobile`** (matches `app.json`).
3. Complete mandatory **App content** sections using drafts in:
   - [`store/play/DATA_SAFETY_ANSWERS.md`](../store/play/DATA_SAFETY_ANSWERS.md)
   - [`store/play/CONTENT_RATING_ANSWERS.md`](../store/play/CONTENT_RATING_ANSWERS.md)
4. **Privacy policy URL:** `https://kupa-pay.com/legal/privacy` (production `legal_documents` must be published — see [PLAY_STORE_ANDROID.md](PLAY_STORE_ANDROID.md) §0.1).
5. Upload listing text from `store/play/<locale>/` and graphics from `store/play/graphics/`.

---

## 4. Service account + API access (for EAS submit & automation)

1. Play Console → **Setup → API access** → link a Google Cloud project.
2. Create a **service account** with **Release manager** (or Admin) on the Play Console user list.
3. Download JSON key → store locally as `cost-share-app/apps/mobile/google-play-service-account.json` (**never commit**).
4. Add GitHub repository secret **`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`** (full JSON string) for [play-internal.yml](../.github/workflows/play-internal.yml).
5. Add Expo secret **`EXPO_TOKEN`** ([Expo access tokens](https://expo.dev/accounts/saussilberg/settings/access-tokens)).

After the **first** `.aab` upload, copy **App signing key** SHA-1 / SHA-256 from Play Console → Setup → App signing into Google Cloud OAuth (Android client) and Supabase (`KUPAPAY_ANDROID_RELEASE_SHA256`) — see [PLAY_STORE_ANDROID.md](PLAY_STORE_ANDROID.md) §3.3.

---

## 5. In-app products (Play Console)

Create products with these **exact IDs** (must match RevenueCat and the app):

| Product ID | Play type |
|------------|-----------|
| `kupapay_pro_monthly` | Subscription, base plan monthly |
| `kupapay_pro_yearly` | Subscription, base plan yearly |
| `kupapay_trip_pass` | One-time product **or** prepaid / non-renewing subscription (30-day Trip Pass) |

Set prices (VAT-inclusive) in Console. Optional: 7-day free trial on monthly/yearly in Play Console offers (mirrors App Store).

**Automation (optional, after API access):** use [Google Play Developer API](https://developers.google.com/android-publisher) (`inappproducts`, `monetization.subscriptions`) — no agent should call this until the service account exists.

---

## 6. RevenueCat (Google Play)

Follow [KUPAPAY_PRO_SETUP.md](KUPAPAY_PRO_SETUP.md), Android-specific:

1. RevenueCat project → **Apps** → add **Google Play** app (`com.kupapay.mobile`).
2. Play Console → API access → link service account; in RevenueCat upload **Google Play service account JSON** (same or dedicated SA with financial permissions per RevenueCat docs).
3. Map products to entitlement **`pro`** and offering **`default`** packages (`$rc_monthly`, `$rc_annual`, `trip_pass`).
4. Copy **Android public SDK key** (`goog_…`) → GitHub secret **`EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`** and EAS env (`eas-sync-secrets.sh`).
5. Webhook URL → Supabase `revenuecat-webhook` (same endpoint for iOS + Play events).

---

## 7. First internal release (no production)

**Option A — GitHub Actions (recommended):**

1. Configure secrets above.
2. **Actions → Play Internal Android → Run workflow** on `dev` or `main`, `pro_enabled` as needed.
3. Workflow uses EAS **`autoIncrement`** for `versionCode` and submits to **internal** track only (`eas.json`).

**Option B — local:**

```bash
cd cost-share-app/apps/mobile
npm run eas:build:android
npm run eas:submit:android
```

4. Play Console → **Testing → Internal testing** → add tester Gmail addresses → share opt-in link.
5. Run smoke tests in [PLAY_STORE_ANDROID.md §8](PLAY_STORE_ANDROID.md#8-on-device-smoke-test-after-internal-testing-install).

---

## 8. What stays out of scope for automation

- Paying the $25 developer fee or completing identity verification.
- Merchant / tax / banking setup.
- Promoting to **Production** or **Open testing** without explicit owner approval.
- Creating Play products before the app record exists (Console UI or API after §4).

---

## 9. Quick reference

| Item | Value |
|------|--------|
| Package | `com.kupapay.mobile` |
| Entitlement (RevenueCat) | `pro` |
| Subscription SKUs | `kupapay_pro_monthly`, `kupapay_pro_yearly` |
| Trip Pass SKU | `kupapay_trip_pass` |
| Android RC key env | `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` |
| Pro master flag | `EXPO_PUBLIC_KUPAPAY_PRO_ENABLED` |
| AdMob Android app id | `ca-app-pub-8860544182475196~8155234876` |
| Offer code redemption (Android) | Paywall → opens `https://play.google.com/redeem` |
