# Google Play — Data safety form (draft answers)

Copy into **Play Console → App content → Data safety**. Re-verify against `cost-share-app/apps/mobile` before each major release. Canonical narrative also lives in [docs/PLAY_STORE_ANDROID.md](../docs/PLAY_STORE_ANDROID.md) §6.

**Data collected:** Yes — by KupaPay (developer).

| Data type | Collected | Shared | Optional | Purpose |
|-----------|-----------|--------|----------|---------|
| Name | Yes | No | No | Account, display in groups |
| Email | Yes | No | No | Account identifier |
| User IDs | Yes | No | No | Supabase auth id |
| Photos | Yes | No | Yes | Avatar, group image, receipt (system photo picker) |
| App interactions | Yes | No | No | Expenses, groups, settlements |
| Crash logs | Yes | Yes (Sentry) | No | Stability |
| Diagnostics | Yes | Yes (Sentry) | No | Performance / debugging |
| Device or other IDs | Yes | Yes (Google AdMob) | No | Rewarded ads (Advertising ID) |

**Product analytics:** PostHog EU host; explicit events only; user id = Supabase UUID (no email in analytics). Declare if the questionnaire separates analytics from ads.

**Security practices:** Encrypted in transit (HTTPS); encrypted at rest (Supabase); users can delete account in-app; not targeting Families / under-13.

**Photos permission declaration:** App does **not** use broad gallery access; uses Android photo picker. Manifest blocks `READ_MEDIA_*`.

**Advertising ID:** Yes — AdMob rewarded ads.
