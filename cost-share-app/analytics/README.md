# KupaPay growth analytics (#422)

PostHog project (EU): `https://eu.i.posthog.com`

## In-app admin (Postgres)

App admins: **Settings → Admin portal → MAU & north star** calls `get_growth_metrics()` (same payload as weekly CI). Non-admins receive `not_admin` from the RPC.

Optional deep link env (Expo web / mobile):

- `EXPO_PUBLIC_POSTHOG_PROJECT_ID`
- `EXPO_PUBLIC_POSTHOG_MAU_DASHBOARD_ID` or `EXPO_PUBLIC_POSTHOG_MAU_DASHBOARD_URL`

## Dashboard: MAU / WAU / DAU + north star

1. Run `node scripts/posthog-ensure-mau-dashboard.mjs` (creates the dashboard shell if missing).
2. Run `node scripts/posthog-ensure-mau-dashboard-tiles.mjs` to idempotently create/update insights from `posthog-dashboard-mau-tiles.json` and pin them to the dashboard (DAU/WAU/MAU × platform/locale, north-star HogQL, funnels).
3. Manual fallback: copy specs from `posthog-dashboard-mau-tiles.json` and HogQL from `posthog-growth-queries.hogql` in the PostHog UI.

### Environment (never commit secrets)

| Variable | Purpose |
|----------|---------|
| `POSTHOG_PERSONAL_API_KEY` or `FREE_TIER_POSTHOG_PERSONAL_API_KEY` | Personal API key with `insight:write` + `dashboard:write` |
| `POSTHOG_PROJECT_ID` or `FREE_TIER_POSTHOG_PROJECT_ID` | Numeric project id |
| `POSTHOG_HOST` or `FREE_TIER_POSTHOG_HOST` | API host (default `https://eu.i.posthog.com`) |

```bash
cd cost-share-app
export POSTHOG_PERSONAL_API_KEY=…
export POSTHOG_PROJECT_ID=…
node scripts/posthog-ensure-mau-dashboard.mjs
node scripts/posthog-ensure-mau-dashboard-tiles.mjs
npm run test:posthog-mau
```

### Required tiles

| Tile | Type | Event / query | Breakdown |
|------|------|---------------|-----------|
| DAU | Trends → unique users | `app_open` | `properties.platform`, `properties.locale` |
| WAU | Trends → unique users, week | `app_open` | platform, locale |
| MAU | Trends → unique users, month | `app_open` | platform, locale |
| North star (PostHog) | HogQL | `posthog-growth-queries.hogql` north-star query | — |
| Activation funnel | Funnel 14d | signup → group_created → expense_added | platform |
| Invite funnel | Funnel 14d | invite_sent → invite_accepted → expense_added | platform |
| Paywall funnel | Funnel 30d | paywall_view → trial_start → purchase_completed | platform |

## Weekly Postgres snapshot (authoritative north star)

GitHub Action [`.github/workflows/growth-metrics-weekly.yml`](../../.github/workflows/growth-metrics-weekly.yml) calls `get_growth_metrics()` when repository secrets are set:

- `GROWTH_METRICS_SUPABASE_URL`
- `GROWTH_METRICS_SUPABASE_ANON_KEY`
- `GROWTH_METRICS_ADMIN_JWT`

Local CLI:

```bash
cd cost-share-app
node scripts/print-growth-metrics.mjs
```

SQL reference: `growth-metrics-snapshot.sql`.
