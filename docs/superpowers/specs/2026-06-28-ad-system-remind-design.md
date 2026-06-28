# Design: Ad System + Remind to Settle Up

**Date:** 2026-06-28  
**Branch:** add-ad-features  
**Status:** Approved for implementation

---

## Overview

Two features built in sequence:

1. **Rewarded Ad System (Foundation)** — a reusable `useRewardedAd` hook + `AdOrGoProModal` component + `monetization_events` logging table. Every ad gate in the app uses this foundation.
2. **Remind to Settle Up** — a "Send Reminder" button on debt rows that gates behind the ad system, then sends a push notification (via KupaPay) or a native share (outside the app).

Feature 1 must be complete before Feature 2 begins.

---

## Feature 1: Rewarded Ad System

### Architecture

Pure hook-based. No global provider or Zustand state. Each usage site mounts `useRewardedAd(featureKey)`, which preloads an ad unit on mount and returns `{ show, completed, loading }`. State is local to the hook instance.

The app requires a **dev build** (not Expo Go) since `react-native-google-mobile-ads` is a native module. Test ad unit IDs are used until real AdMob IDs are provided.

### `useRewardedAd(featureKey)`

```
hook useRewardedAd(featureKey: string)
  → { show: () => void, completed: boolean, loading: boolean }
```

- On mount: loads a rewarded ad unit using test ID (`ca-app-pub-3940256099942544/5224354917` iOS / `ca-app-pub-3940256099942544/5354046379` Android).
- `show()`: presents the loaded ad. On reward earned → sets `completed = true`. Logs `ad_gate_watch_completed` to `monetization_events`.
- `loading`: true while the ad is loading (after `show()` is called but before the ad is ready, and during the initial load).
- Logs `ad_gate_watch_tapped` when `show()` is called.

### `AdOrGoProModal`

A modal bottom sheet shown before every ad gate.

**Props:**
```typescript
interface AdOrGoProModalProps {
  visible: boolean;
  featureKey: string;
  onAdCompleted: () => void;
  onDismiss: () => void;
}
```

**Behavior:**
- Shown by the caller when user taps an ad-gated action.
- Two options: "Watch a short ad" and "Go Pro".
- On mount: calls `useRewardedAd(featureKey)` internally, preloads ad.
- "Watch ad" tapped → logs `ad_gate_watch_tapped` → calls `show()`. On `completed` → calls `onAdCompleted()` → modal closes.
- "Go Pro" tapped → logs `ad_gate_pro_tapped` → dismisses modal → shows `showInfoToast('monetization.goProComingSoon')`.
- Dismissing (back/close) → calls `onDismiss()`.
- Logs `ad_gate_shown` when `visible` becomes true.

### `monetization_events` Table

```sql
CREATE TABLE monetization_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  event_type  TEXT NOT NULL CHECK (event_type IN (
                 'ad_gate_shown',
                 'ad_gate_watch_tapped',
                 'ad_gate_watch_completed',
                 'ad_gate_pro_tapped',
                 'remind_sent'
               )),
  platform    TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

RLS: users can insert their own rows, nobody can read others'. Admins read all.

Logging is fire-and-forget (`void logMonetizationEvent(...)`) — never blocks the user flow. Errors are swallowed silently.

### Admin Monetization Analytics Screen

A new screen in the admin portal: `AdminMonetizationScreen`.

Accessible from `AdminPortalScreen` via a new `SettingsRow` ("Monetization").

Displays:
- **Funnel** (all-time): shown → watch tapped → watch completed → pro tapped, with conversion rates between steps.
- **By feature_key**: counts per event type broken down by feature.
- **By platform**: iOS vs Android.
- **Over time**: daily totals for the past 7 days (sparkline or table).

Data fetched via a new `useAdminMonetizationMetricsQuery` hook that calls a Supabase RPC `get_monetization_metrics` (admin-only, SECURITY DEFINER).

---

## Feature 2: Remind to Settle Up

### Button Placement

A "Send Reminder" button (or icon) appears on `DebtRow` when:
- The current user is **not** the `fromUserId` (i.e., they are the one owed money, not the debtor).
- The debt is in the "involved" set (current user is a party).

`DebtRow` receives an optional `onRemind?: () => void` prop. When provided and conditions are met, a small reminder icon/button renders alongside the settle button. Callers that don't need the remind feature omit the prop.

Placement in code:
- `SettleUpListScreen` — passes `onRemind` for "involved" debt rows where `debt.toUserId === currentUserId`.
- `SimplifiedDebtsSection` — same condition, same prop.

### Full Remind Flow

```
User taps "Send Reminder"
  → AdOrGoProModal shown (featureKey: 'remind_user')
  → User watches ad
  → onAdCompleted fires
  → ReminderOptionsSheet opens (bottom sheet, 2 options)
      ├── "Via KupaPay"  → ReminderComposeSheet
      └── "Share outside app" → native share sheet
```

#### Via KupaPay — ReminderComposeSheet

A bottom sheet with:
- Editable text field pre-filled with the default message (see below).
- "Send" button.

**Default message:**
```
Hey, just a reminder that you owe [amounts] in [group name] 😊
```
Where `[amounts]` lists every currency: e.g. `$30 USD and ₪20 ILS`. The debt passed to the sheet may be single-currency (it's one `DebtRow`), so amounts = `{currency} {amount}`.

On send:
1. Calls `sendSettleReminder(groupId, toUserId, message)` service function.
2. Service calls `supabase.rpc('send_settle_reminder', { p_group_id, p_to_user_id, p_message })`.
3. RPC inserts an `activity_events` row: `kind = 'settle_up_reminder'`, `user_id = toUserId`, `actor_user_id = senderId`, `group_id`, `metadata = { message }`.
4. Existing Postgres trigger fires `send-push` edge function.
5. Push notification body = the custom message from `metadata.message`.
6. RPC also logs a `remind_sent` event type to `monetization_events` (as a separate insert inside the RPC, or the client logs it).
7. Shows `showSuccessMessage('remind.sent')` toast.

#### Share Outside App — native share sheet

Calls `shareTextMessage(message + '\n' + deepLink)` from existing `lib/platformShare.ts`.

**Deep link format** (extending existing system):
- `https://<APP_WEB_HOST>/sr/<group_invite_token>` — web URL
- `com.kupapay.mobile://invite/sr/<group_invite_token>` — custom scheme

`group_invite_token` is the group's existing `groups.invite_token` column (already generated for all groups). No new DB table needed.

`parseIncomingUrl` gets a new case: path `/sr/<token>` → `{ kind: 'settleReminder', token }`.

On open:
1. `redeemInviteLink` handles `kind: 'settleReminder'`:
   - Calls `supabase.rpc('resolve_settle_reminder_link', { p_token })` which looks up `groups.invite_token`, returns `group_id` and checks `is_group_member(group_id, auth.uid())`.
   - If member: sets `pendingNavigation = { target: 'settleUpList', groupId }`.
   - If not member: shows `showErrorToast('remind.notGroupMember')`.

`pendingNavigation` store gets new variant: `{ target: 'settleUpList'; groupId: string }`.

`usePendingNavigationFlush` handles it by calling:
```typescript
navigation.navigate('Groups', {
  screen: 'SettleUpList',
  params: { groupId },
});
```

### `settle_up_reminder` Activity Event Kind

New member added to `ActivityEventKind` union: `'settle_up_reminder'`.

Changes required:
- `packages/shared/src/types/index.ts` — add to union.
- `packages/shared/src/notifications/content.ts` — `KIND_TO_CATEGORY`: maps to `'settlements'` category (reuses `settlementsPush` preference).
- `supabase/functions/send-push/render.ts` — new `ActivityKind`, new case in `renderNotification` that reads `metadata.message` for the body.
- `supabase/functions/send-push/locales/en.json` and `he.json` — new key `settle_up_reminder` (title only; body comes from metadata).
- `lib/pushTapRouting.ts` — new case: `'settle_up_reminder'` → `{ target: 'settleUpList', groupId }` (requires store type update too).
- DB migration: add `'settle_up_reminder'` to `activity_events.kind` CHECK constraint.

### Activity Feed Item

The recipient sees a new item in their activity feed:  
`"[Name] sent you a reminder to settle up in [group name]"`

Rendered by the existing `ActivityFeedScreen` item renderer. New case for `kind === 'settle_up_reminder'` in `activityCardVariant.ts` and `ActivityFeedScreen`'s press handler (navigates to SettleUpList).

### `send_settle_reminder` RPC (new migration)

```sql
CREATE OR REPLACE FUNCTION send_settle_reminder(
  p_group_id  UUID,
  p_to_user_id UUID,
  p_message   TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Verify caller is a group member
  IF NOT is_group_member(p_group_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_group_member';
  END IF;
  -- Verify recipient is a group member
  IF NOT is_group_member(p_group_id, p_to_user_id) THEN
    RAISE EXCEPTION 'recipient_not_group_member';
  END IF;
  -- Verify caller is not the debtor (can't remind yourself)
  IF p_to_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_remind_self';
  END IF;

  INSERT INTO activity_events (
    id, user_id, kind, group_id, ref_id, actor_user_id, metadata
  ) VALUES (
    gen_random_uuid(),
    p_to_user_id,
    'settle_up_reminder',
    p_group_id,
    gen_random_uuid(), -- ref_id: no linked resource row; random UUID satisfies NOT NULL
    auth.uid(),
    jsonb_build_object('message', p_message)
  );
END;
$$;
```

### `resolve_settle_reminder_link` RPC (new migration)

```sql
CREATE OR REPLACE FUNCTION resolve_settle_reminder_link(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_group_id UUID;
BEGIN
  SELECT id INTO v_group_id FROM groups WHERE invite_token = p_token;
  IF v_group_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF NOT is_group_member(v_group_id, auth.uid()) THEN
    RETURN jsonb_build_object('error', 'not_member');
  END IF;
  RETURN jsonb_build_object('group_id', v_group_id);
END;
$$;
```

---

## Database Migrations (summary)

1. **`monetization_events` table** — new table + RLS + admin RPC `get_monetization_metrics`.
2. **`settle_up_reminder` kind** — alter `activity_events.kind` CHECK constraint to include `'settle_up_reminder'`.
3. **`send_settle_reminder` RPC** — user-callable, SECURITY DEFINER.
4. **`resolve_settle_reminder_link` RPC** — resolves group token → group_id with membership check.

---

## New Files

```
apps/mobile/
  hooks/useRewardedAd.ts
  components/ads/AdOrGoProModal.tsx
  components/remind/ReminderOptionsSheet.tsx
  components/remind/ReminderComposeSheet.tsx
  services/monetization.service.ts
  services/remind.service.ts
  hooks/queries/useAdminMonetizationMetricsQuery.ts
  screens/admin/AdminMonetizationScreen.tsx

packages/shared/src/
  (types/index.ts — modified)
  (notifications/content.ts — modified)
  (lib/activityCardVariant.ts — modified)

supabase/functions/send-push/
  (render.ts — modified)
  (locales/en.json — modified)
  (locales/he.json — modified)

supabase/migrations/
  YYYYMMDD_monetization_events.sql
  YYYYMMDD_settle_up_reminder_kind.sql
  YYYYMMDD_send_settle_reminder_rpc.sql
  YYYYMMDD_resolve_settle_reminder_link_rpc.sql
```

---

## Dev Build Requirement

`react-native-google-mobile-ads` is a native module. It will not run in Expo Go. A dev build (`expo prebuild && expo run:ios / run:android`) is required to test ad functionality. Use test ad unit IDs until real AdMob app ID and ad unit IDs are provided.

---

## What Is NOT in Scope

- Pro subscription / paywall implementation.
- Cooldown / rate limiting on reminders.
- Currency consolidation feature (featureKey is wired up but the feature itself is a separate spec).
- Web push notifications.
