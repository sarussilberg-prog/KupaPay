# KupaPay Pro v1 — owner setup (RevenueCat + stores)

Mobile code is behind `EXPO_PUBLIC_KUPAPAY_PRO_ENABLED=true` (default off). RevenueCat SDK no-ops when API keys are missing.

## Product identifiers (must match exactly)

Create these in **App Store Connect**, **Google Play Console**, and link them in **RevenueCat**:

| Store product ID | Type | Planned price (VAT-inclusive, owner sets in stores) |
|---|---|---|
| `kupapay_pro_monthly` | Auto-renewable subscription | ₪12.90 / month |
| `kupapay_pro_yearly` | Auto-renewable subscription | ₪69.90 / year |
| `kupapay_trip_pass` | Non-consumable or non-renewing subscription (30-day unlock) | TBD |

## RevenueCat project

1. **Entitlement:** `pro` — attach both subscription products and optionally Trip Pass if you model group unlock via entitlement; server webhook handles Trip Pass via `group_passes` table using subscriber attribute `group_id`.
2. **Offering:** `default` (or set `EXPO_PUBLIC_REVENUECAT_OFFERING_ID`) with packages:
   - `$rc_monthly` → `kupapay_pro_monthly`
   - `$rc_annual` → `kupapay_pro_yearly`
   - Custom package identifier `trip_pass` → `kupapay_trip_pass` (Android may use package id `kupapay_trip_pass` instead — the app resolves Trip Pass by store product id `kupapay_trip_pass` as well)
3. **API keys** (Project → API keys):
   - iOS public SDK key → `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
   - Android public SDK key → `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
4. **App user ID:** SDK calls `Purchases.logIn(supabaseUserId)` after sign-in.
5. **Expo config:** Do **not** add `react-native-purchases` to `app.json` `plugins` (it is not a config plugin and breaks `expo export --platform web`). Native linking comes from the npm dependency + prebuild; web uses `purchases.service.web.ts` stubs.
5. **Trip Pass (one-time):** Before purchase, app sets subscriber attribute `group_id` to the active group UUID. Unlocks Pro for **every member** of that group for **30 days**, **no renewal**.
6. **Yearly plan perk:** Each yearly purchase or renewal grants **one** redeemable Trip Pass credit on the subscriber’s profile (`included_trip_pass_credits`). The user redeems it in-app for a chosen group while their individual Pro subscription is active (`redeem_included_trip_pass` RPC).

## Webhook (Supabase Edge Function)

Deploy `revenuecat-webhook` and register in RevenueCat → Integrations → Webhooks:

| Item | Value |
|---|---|
| URL | `https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook` |
| Authorization header | Same value as Supabase secret `REVENUECAT_WEBHOOK_SECRET` (sent as `Authorization: Bearer <secret>` or raw secret) |

Supabase Edge Function secrets (dev + prod separately):

- `REVENUECAT_WEBHOOK_SECRET` — shared with RevenueCat dashboard
- `SUPABASE_SERVICE_ROLE_KEY` — already available to functions; used for `profiles.pro_until` and `group_passes` writes

## Database

Migrations (apply after `20261010230000_privacy_admob_google_llc.sql` and security `20261011010000+`):

| Version | File |
|---|---|
| `20261011020000` | `kupapay_pro_entitlements.sql` — `profiles.pro_until`, `group_passes`, `get_my_pro_status`, `has_pro` |
| `20261011021000` | `pro_legal_documents.sql` — Terms §9 + RevenueCat privacy (stacks on AdMob/EU ad text) |
| `20261011022000` | `pro_webhook_idempotency_trip_pass_intents.sql` — idempotent webhook RPC, Trip Pass intents |

Apply on **development** first (`dev` branch / `drxfbicunusmipdgbgdk`). Production only when releasing Pro publicly.

## App env (EAS / `.env.production`)

```
EXPO_PUBLIC_KUPAPAY_PRO_ENABLED=true
EXPO_PUBLIC_SHOW_KUPAPAY_PRO_UPSELL=true
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_...
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_...
# optional:
# EXPO_PUBLIC_REVENUECAT_OFFERING_ID=default
```

## Apple Guideline 3.1.2

Paywall shows localized price/period from StoreKit via RevenueCat, auto-renew disclosure, cancel instructions, Terms + Privacy links, and Restore Purchases. Settings includes **Manage subscription** (opens platform subscription management).

When monthly/yearly products include a **7-day free trial**, the paywall uses `checkTrialOrIntroductoryPriceEligibility` for the trial CTA and Apple-required post-trial price copy. After a trial starts, the app schedules a **local notification** two days before trial end and registers `profiles.pro_trial_ends_at` for a server fallback.

### Trial reminder cron (server fallback)

Deploy `pro-trial-reminder-dispatch` and call it daily (same `PUSH_WEBHOOK_SECRET` as `send-push`):

| Item | Value |
|---|---|
| URL | `https://<project-ref>.supabase.co/functions/v1/pro-trial-reminder-dispatch` |
| Header | `x-webhook-secret: <PUSH_WEBHOOK_SECRET>` |

Apply migration `20261015120000_pro_trial_reminder.sql` on dev before production.
