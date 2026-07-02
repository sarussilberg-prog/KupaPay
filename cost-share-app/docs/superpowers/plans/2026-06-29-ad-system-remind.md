# Ad System + Remind to Settle Up — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable rewarded-ad foundation (useRewardedAd hook + AdOrGoProModal + monetization_events logging) and a "Remind to Settle Up" feature that gates behind it, sending push notifications or shareable deep links to debtors.

**Architecture:** Feature 1 (Ad System) is built first and is fully independent. Feature 2 (Remind) uses AdOrGoProModal, inserts activity_events rows via a new send_settle_reminder RPC (triggering existing push pipeline), and extends parseIncomingUrl with /sr/<token> share links. A new settle_up_reminder ActivityEventKind threads through shared types, DB constraint, send-push edge function, push tap routing, and activity feed renderer.

**Tech Stack:** React Native/Expo, react-native-google-mobile-ads, Supabase (RPCs, migrations, Edge Functions), React Query, Zustand, i18next, react-native-toast-message, BottomSheetShell.

## Global Constraints

- react-native-google-mobile-ads requires a dev build — does not work in Expo Go. Run expo prebuild && expo run:ios or expo run:android after yarn install.
- Test ad unit IDs: iOS rewarded ca-app-pub-3940256099942544/1712485313, Android rewarded ca-app-pub-3940256099942544/5354046379.
- All user-facing strings use i18n keys. No hardcoded copy.
- monetization_events logging is always fire-and-forget (void, never awaited).
- DB migrations in supabase/migrations/ with prefix 20260629HHMMSS_<name>.sql — create files only, do not apply.
- All Supabase calls in services/ or hooks/queries/ — never in components.
- metadata.body stores the custom reminder message (consistent with handler.ts md.body pattern).
- NO git commits at any point.

---

### Task 1: Package setup
**Files:** Modify apps/mobile/package.json, apps/mobile/app.json
- [ ] Add react-native-google-mobile-ads to dependencies in package.json
- [ ] Add plugin config to app.json (placeholder AdMob App IDs)
- [ ] Run yarn install from cost-share-app/apps/mobile

### Task 2: DB migrations (create files only)
**Files:** supabase/migrations/20260629120000_monetization_events.sql, 20260629121000_monetization_admin_rpc.sql, 20260629122000_settle_up_reminder_kind.sql, 20260629123000_send_settle_reminder_rpc.sql, 20260629124000_resolve_settle_reminder_link_rpc.sql

### Task 3: monetization.service.ts
**Files:** Create apps/mobile/services/monetization.service.ts

### Task 4: useRewardedAd hook
**Files:** Create apps/mobile/hooks/useRewardedAd.ts

### Task 5: AdOrGoProModal
**Files:** Create apps/mobile/components/ads/AdOrGoProModal.tsx

### Task 6: Admin monetization screen
**Files:** Create apps/mobile/hooks/queries/useAdminMonetizationMetricsQuery.ts, apps/mobile/screens/admin/AdminMonetizationScreen.tsx

### Task 7: ActivityEventKind extension
**Files:** Modify packages/shared/src/types/index.ts, packages/shared/src/notifications/content.ts, supabase/functions/send-push/handler.ts

### Task 8: send-push render + locales
**Files:** Modify supabase/functions/send-push/render.ts, supabase/functions/send-push/locales/en.json, supabase/functions/send-push/locales/he.json

### Task 9: Client routing
**Files:** Modify apps/mobile/store/index.ts, apps/mobile/lib/pushTapRouting.ts, apps/mobile/hooks/usePendingNavigationFlush.ts, apps/mobile/services/deepLinks.service.ts

### Task 10: remind.service.ts
**Files:** Create apps/mobile/services/remind.service.ts

### Task 11: Mobile i18n
**Files:** Modify apps/mobile/i18n/locales/en.json, apps/mobile/i18n/locales/he.json

### Task 12: DebtRow — onRemind prop
**Files:** Modify apps/mobile/components/balances/DebtRow.tsx

### Task 13: ReminderOptionsSheet + ReminderComposeSheet
**Files:** Create apps/mobile/components/remind/ReminderOptionsSheet.tsx, apps/mobile/components/remind/ReminderComposeSheet.tsx

### Task 14: Wire into SettleUpListScreen + SimplifiedDebtsSection
**Files:** Modify apps/mobile/screens/balances/SettleUpListScreen.tsx, apps/mobile/components/balances/SimplifiedDebtsSection.tsx

### Task 15: Activity feed + navigator
**Files:** Modify apps/mobile/lib/activityCardVariant.ts, apps/mobile/components/ActivityItemCard.tsx, apps/mobile/components/ActivityItem.tsx, apps/mobile/screens/activity/ActivityFeedScreen.tsx, apps/mobile/navigation/AppNavigator.tsx, apps/mobile/screens/admin/AdminPortalScreen.tsx
