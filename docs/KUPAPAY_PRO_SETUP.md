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

## Google Play — subscriptions & trial

Configure in Play Console (see [`store/play/SUBSCRIPTION_OFFERS.md`](../store/play/SUBSCRIPTION_OFFERS.md)):

| Product | Free trial on base plan |
|---------|-------------------------|
| `kupapay_pro_monthly` | **14 days** |
| `kupapay_pro_yearly` | **14 days** |

Android paywall: **no EU withdrawal checkbox** (Play purchase flow). Trial copy uses **14 days** on Android; iOS remains **7 days** when configured in App Store Connect.

## Apple Guideline 3.1.2

Paywall shows localized price/period from the store via RevenueCat (`priceString`), auto-renew disclosure, cancel instructions, Terms + Privacy links, **Restore Purchases**, and **Redeem offer code** (iOS App Store sheet; Android opens `https://play.google.com/redeem`). Settings includes **Manage subscription** (`showManageSubscriptions` / Play subscription center).

When monthly/yearly products include a **14-day free trial**, the paywall uses `checkTrialOrIntroductoryPriceEligibility` for the trial CTA and post-trial price copy. Trial length in the UI is derived from the store intro offer (`package.product.introPrice`) when available, with **14 days** as the fallback. After a trial starts, the app schedules a **local notification** two days before trial end and registers `profiles.pro_trial_ends_at` for a server fallback.

Apple/Google are merchant of record; the app does **not** show an EU withdrawal waiver checkbox.

### Google Play (manual)

Configure the **base-plan free trial** on `kupapay_pro_monthly` and `kupapay_pro_yearly` to **14 days** in Play Console (Offers → free trial).

### Trial reminder cron (server fallback)

Deploy `pro-trial-reminder-dispatch` and call it daily (same `PUSH_WEBHOOK_SECRET` as `send-push`):

| Item | Value |
|---|---|
| URL | `https://<project-ref>.supabase.co/functions/v1/pro-trial-reminder-dispatch` |
| Header | `x-webhook-secret: <PUSH_WEBHOOK_SECRET>` |

Apply migration `20261015120000_pro_trial_reminder.sql` on dev before production.

### Recurring expenses cron (Pro v2)

Deploy `pro-recurring-expense-dispatch` and call it daily (same `PUSH_WEBHOOK_SECRET`):

| Item | Value |
|---|---|
| URL | `https://<project-ref>.supabase.co/functions/v1/pro-recurring-expense-dispatch` |
| Header | `x-webhook-secret: <PUSH_WEBHOOK_SECRET>` |

Apply migration `20261016120000_recurring_expenses.sql` on dev before production.

### Smart payment reminders cron (Pro v2)

Deploy `pro-smart-reminder-dispatch` and call it daily (same `PUSH_WEBHOOK_SECRET`):

| Item | Value |
|---|---|
| URL | `https://<project-ref>.supabase.co/functions/v1/pro-smart-reminder-dispatch` |
| Header | `x-webhook-secret: <PUSH_WEBHOOK_SECRET>` |

Apply migration `20261016130000_smart_payment_reminders.sql` on dev before production.

### Trip budget alerts (Pro v2)

No cron: alerts run from the `expenses` trigger via `evaluate_trip_budget_alerts`. Pro members set budget with RPC `set_group_trip_budget`. Activity kind `trip_budget_alert` uses the existing `send-push` pipeline.

Apply migration `20261016140000_trip_budget.sql` on dev before production.

### Spending insights (Pro v2)

RPCs `get_group_spending_by_category`, `get_group_spending_by_member`, and `get_group_spending_by_week` require `has_pro`. No cron.

Apply migration `20261016150000_group_spending_insights.sql` on dev before production.

### Receipt OCR (Pro v2, heuristic)

Deploy `receipt-ocr` (user JWT). Default: **no paid OCR** — paste text + shared heuristic. Optional vendor via `RECEIPT_OCR_API_URL`. See [RECEIPT_OCR.md](RECEIPT_OCR.md).
