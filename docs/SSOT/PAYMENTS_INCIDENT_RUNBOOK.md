# Payments & Pro — incident runbook (Phase 0 Gate J/K)

Companion to `docs/PRO_V2_PLAN.md` §2.2 Gate J/K.

## Detect

- User report (Pro not unlocked after purchase)
- RevenueCat webhook errors
- Supabase Edge logs: `revenuecat-webhook`, `pro-*-dispatch`
- Stuck `revenuecat_webhook_events`

## Triage

1. RC dashboard → customer events for Supabase `app_user_id`
2. DB: `profiles.pro_until`, `group_passes`
3. Compare RC expiry vs DB

## Mitigate

- Kill switch: `EXPO_PUBLIC_KUPAPAY_PRO_ENABLED=false` on EAS env
- No prod SQL without owner (`docs/SSOT/SUPABASE_ENVIRONMENTS.md`)

## Fix forward

- Replay idempotent webhook when safe
- Manual entitlement fix on dev first

## Monitoring (weekly)

| Signal | Source |
|--------|--------|
| Webhook 4xx/5xx | RC + Supabase function logs |
| Cron failures | `pro-*-dispatch` logs |
| Mobile regressions | Sentry release health |
