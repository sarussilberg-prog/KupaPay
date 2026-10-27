# Free-tier limits & mitigation (#426)

**Policy:** Stay on free tiers for Supabase, Vercel, PostHog, Sentry, and Expo unless explicitly approved.

| Provider | Free tier (approx.) | Dashboard | Mitigation at 70% |
|----------|---------------------|-----------|-------------------|
| **Supabase** (dev/prod) | 500 MB DB, 5 GB egress, 2M edge invocations/mo | Project → Settings → Usage | Archive old activity; tighten Realtime; delay non-critical cron |
| **Vercel** (web) | 100 GB bandwidth, serverless execution limits | Team → Usage | Cache static assets; reduce ISR churn; disable heavy preview builds |
| **PostHog** | 1M events/mo (cloud free) | Project → Billing | Sample `app_open`; drop non-funnel autocapture (already off) |
| **Sentry** | 5k errors/mo | Stats → Usage | Raise `tracesSampleRate` floor; filter benign network breadcrumbs |
| **Expo / EAS** | Limited build minutes on free | expo.dev → Usage | Prefer local `expo run`; batch store releases |

## Weekly automation

GitHub Action [`.github/workflows/free-tier-usage-weekly.yml`](../../.github/workflows/free-tier-usage-weekly.yml) runs `cost-share-app/scripts/check-free-tier-usage.mjs` when optional API tokens are configured. It **warns at ≥70%** of configured quotas and never mutates production.

### Optional repository secrets

| Secret | Purpose |
|--------|---------|
| `FREE_TIER_SENTRY_AUTH_TOKEN` | Sentry org usage API |
| `FREE_TIER_SENTRY_ORG` | Org slug |
| `FREE_TIER_POSTHOG_PERSONAL_API_KEY` | PostHog billing/usage endpoint |
| `FREE_TIER_POSTHOG_PROJECT_ID` | Project id |

Manual checks (no secret): Supabase and Vercel dashboards linked above — record in the Action summary when APIs are unavailable.
