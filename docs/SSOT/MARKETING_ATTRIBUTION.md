# Marketing attribution (#424)

**Platforms:** iOS, Android, Expo Web (same React Native bundle).

## Captured fields (first touch)

| Source | Mechanism |
|--------|-----------|
| Web / landing | `utm_*` query params on `location.href` |
| Deep links (all) | UTM + invite params on initial URL |
| iOS ASA | `pt` + `ct` query params on App Store / universal links → `apple_search_ads_campaign` |
| Android Play | Deferred / install links with UTM; coarse `install_referrer` label when from Play deferred link |

Stored locally (`AsyncStorage`) and sent to PostHog as person properties (`acquisition_channel`, `utm_*`). No paid MMP.

## Code

- Parser: `packages/shared/src/analytics/marketingAttribution.ts`
- Bootstrap: `apps/mobile/lib/marketingAttribution.ts` (called from `App.tsx`)

## Retention charts

HogQL starter: `cost-share-app/analytics/posthog-retention-by-channel.hogql`

In PostHog UI: **Retention** insight → cohort `signup` → returning `app_open` → breakdown `acquisition_channel`; compare day 1, 7, 30.
