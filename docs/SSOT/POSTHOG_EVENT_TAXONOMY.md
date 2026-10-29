# PostHog product event taxonomy

**Issues:** [#421](https://github.com/sarussilberg-prog/KupaPay/issues/421) (funnels), [#422](https://github.com/sarussilberg-prog/KupaPay/issues/422) (MAU + north star).

**Source of truth (names):** `cost-share-app/packages/shared/src/analytics/productAnalyticsEvents.ts`

**Platforms:** iOS, Android, and Expo Web (`platform` property). Same event strings on all three.

**Privacy:** Distinct id = Supabase user UUID after sign-in. No email, display name, expense text, or group titles in event properties. Allowed custom keys: opaque ids (`group_id`), enums (`kind`, `feature_key`), and coarse flags.

## Context on every event

| Property | Example | Notes |
|----------|---------|--------|
| `platform` | `ios` \| `android` \| `web` | From `Platform.OS` |
| `app_version` | `2.0.0` | Marketing version from Expo config / shared `APP_VERSION` |
| `locale` | `he` | Short language code (7 supported locales) |
| `$lib` | `kupapay-ios` | PostHog library tag per platform |

## Funnel events (required on all platforms)

| Event | When fired | Typical properties |
|-------|------------|-------------------|
| `signup` | First session after account creation | `provider` |
| `group_created` | User creates their first group (once per install) | `group_id` |
| `expense_added` | Expense successfully created | `group_id` |
| `invite_sent` | OS share sheet opened for an invite link | `kind` (`friend` \| `group`), optional `group_id` |
| `invite_accepted` | User completes friend/group invite deep link | `kind` |
| `settle_up` | Settlement recorded | `group_id` |
| `paywall_view` | Pro paywall shown | `feature_key`, optional `group_id` |
| `trial_start` | RevenueCat trial activated | product metadata (no PII) |

## Suggested PostHog funnels

1. **Activation:** `signup` → `group_created` → `expense_added`
2. **Invite:** `invite_sent` → `invite_accepted` → `expense_added`
3. **Paywall:** `paywall_view` → `trial_start` → `purchase_completed`

Break down all trends by `platform` and `locale`.

## MAU / WAU / DAU (PostHog)

Use **unique users** (`signup` or `app_open`) with calendar intervals:

- **DAU:** unique users, interval day, last 30 days
- **WAU:** unique users, interval week
- **MAU:** unique users, interval month (north-star epic target: 1000 MAU)

Example HogQL snippets live in `cost-share-app/analytics/posthog-growth-queries.hogql`.

## North-star metric

**Definition:** Count of **groups** in a calendar month where **≥2 distinct members** each added at least one expense (`expense_added` in PostHog; `expenses.created_by` in Postgres).

**Postgres (authoritative backfill / weekly ops):**

- View: `analytics_north_star_groups` (not exposed to clients)
- Admin RPC: `get_growth_metrics()` — north star + DAU/WAU/MAU proxy from expense authors
- CLI: `node cost-share-app/scripts/print-growth-metrics.mjs` (requires admin JWT or run SQL in dashboard)

## Instrumentation map

| Layer | Path |
|-------|------|
| Shared names + property builder | `packages/shared/src/analytics/productAnalyticsEvents.ts` |
| Mobile / iOS / Android / Expo Web | `apps/mobile/lib/productAnalytics.ts`, `PostHogAnalyticsProvider.tsx` |
| Web host | Expo export via `apps/web/scripts/build-app-web.sh` (same mobile bundle) |

## Dashboard checklist (#422)

- [x] In-app admin: **Admin portal → MAU & north star** (`get_growth_metrics()`; RLS via `is_app_admin()`)
- [x] Insight: MAU / WAU / DAU from `app_open` — automated via `cost-share-app/scripts/posthog-ensure-mau-dashboard-tiles.mjs` + `posthog-dashboard-mau-tiles.json`
- [x] Insight: North-star groups/month from `expense_added` (HogQL) or Postgres RPC — HogQL in `posthog-growth-queries.hogql`; Postgres via `get_growth_metrics()`
- [x] Breakdowns: `platform`, `locale`
- [x] Weekly: GitHub Action `growth-metrics-weekly.yml` appends Postgres snapshot to job summary
