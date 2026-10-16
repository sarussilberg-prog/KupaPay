# Activity event kind — change checklist

When adding or renaming an `activity_events.kind`, update **all** of the following in one PR (or coordinated PRs):

1. **Database** — `CHECK` constraint / enum on `activity_events.kind` (migration + `-- safe-breaking:` if needed).
2. **Shared types** — `@cost-share/shared` `ActivityEventKind` (and related notification metadata maps).
3. **Edge** — `send-push` render + preference map (`locales/en.json`, `locales/he.json`).
4. **Mobile** — activity card routing, push tap deep links, any feature-specific UI.

Pro v2 kinds (planned): `trip_budget_alert`, recurring-expense notifications (if any), existing `settle_up_reminder`.

Ref: [PRO_V2_PLAN.md](../PRO_V2_PLAN.md) §1.9.
