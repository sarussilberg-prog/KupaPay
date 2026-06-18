# Activity Feed — Edited & Deleted state — Design Spec

Date: 2026-06-18
Branch: verify-debts-algorithm
Status: **brainstormed; pending implementation plan**

## Goal

Make the Activity Feed reflect the full lifecycle of an expense, settlement, or group message:

1. **Edits.** When the source item is edited, the activity row shows the new content (description, amount, currency, expense/settlement date, message body) and gains a small inline "Edited" suffix on the meta line.
2. **Deletes.** When the source item is soft-deleted, the activity row **stays** in the feed (instead of being removed as today), gains a "Deleted" suffix, and resurfaces at the top. Tapping it opens the same detail popup, but the body shows a deletion notice (`"This expense was deleted by {name} at {time}"`) instead of the live details. The popup carries a kebab/options menu whose only action is "Remove from activity" — a per-user hide that deletes that user's activity row only.
3. **Push notifications.** Edits and deletes fire push to all other group members, with distinct copy from creations. ("New expense" → "Updated expense" → "Deleted expense", and the equivalents for settlements and messages.) The wiring (UPDATE trigger → edge function) already exists from the `20260618110000_activity_events_fire_on_edit.sql` migration; this spec adds the per-state copy variants and threads `is_edited` / `is_deleted` through `send-push`.

In all cases the existing actor (`actor_user_id`) and the in-app leading verb ("added"/"posted") stay the same on the row — the suffix carries the meaning. Push titles/bodies are the *only* place where the verb changes.

## Scope

**In scope.**
- Backend migration that augments the three existing `emit_*_activity_events` trigger functions to:
  - On **content edit** (existing UPDATE branch) — also write `'is_edited': true, 'edited_at': NOW()` into `metadata`.
  - On **soft-delete** (currently a DELETE branch) — switch from DELETE to UPDATE: set `metadata.is_deleted = true`, `metadata.deleted_at = NOW()`, `metadata.deleted_by = auth.uid()`, and bump `created_at = NOW()`.
- New RLS policy allowing a user to `DELETE` their own `activity_events` row.
- New mobile service `removeActivityEvent(eventId)` calling that DELETE.
- Frontend:
  - `ActivityItem` renders ` · Edited` or ` · Deleted` suffix when the corresponding metadata flag is true. "Deleted" wins over "Edited".
  - `ActivityFeedScreen` recognizes deleted rows: on tap, opens `FeedItemDetailSheet` with the metadata-built stub and a new `deletedNotice` prop, **without** the live expense/settlement refetch.
  - `FeedItemDetailSheet` renders a deletion-notice variant when the new `deletedNotice` prop is set: deletion message body, no Edit/Delete icon buttons, a kebab button that opens a single "Remove from activity" sheet/alert.
  - Removal uses the existing `platformAlert` confirmation pattern (matching the in-app delete confirmation), then calls `removeActivityEvent` and invalidates the activity query.
- i18n: new keys for the badges, deletion notice, kebab menu, and confirmation copy.
- **Push content variants**: `send-push` edge function (`render.ts` + `handler.ts`) gains edit/delete renderings for `expense_added`, `settlement_added`, `message_posted`. Reads `is_edited` / `is_deleted` from the row's `metadata` and branches.
- Tests: unit coverage for the badge suffixes, deletion-notice rendering, the remove-from-activity action, and the new push renderers.

**Explicitly out of scope.**
- Edit history / diff view.
- Restoring a deleted item from the activity feed.
- A separate `activity_kind = 'expense_deleted'` event (we mutate the existing row instead — keeps one row per source item per user).
- A separate `deleted_by_user_id` column on `activity_events`. The deleter is captured inside `metadata.deleted_by`.
- A kebab on non-deleted activity rows. Only the detail popup of a deleted row carries one.
- Backfill: pre-existing rows that were edited or deleted before this migration ships will not show the badges; deletes that happened before this ships are already gone from the table (today's trigger DELETEs them). Acceptable.
- Separate user preference to opt out of edit/delete push (vs. add push). Edit/delete pushes piggyback on the existing push pref. If users want finer control later, that's a follow-up.
- Per-user mute / hide for non-deleted rows (e.g., "Hide from feed" on every row).

## Locked decisions

| # | Topic | Decision |
|---|---|---|
| 1 | How edit/delete state is signaled to the client | Two boolean flags inside the existing `activity_events.metadata` jsonb: `is_edited` and `is_deleted`. Companion timestamps `edited_at` / `deleted_at`. For deletes, also `deleted_by` (user id). No new columns on the table. |
| 2 | Backend vs. frontend-only | Backend trigger tweak. Rejected: frontend-only join to `expenses`/`settlements` (more code, more coupling); per-row refetch (N+1). |
| 3 | UI placement (badge) | Inline suffix on the existing timestamp meta line: `{actor} · {timestamp} · Edited` or `... · Deleted`. Same color/size as the surrounding meta — muted secondary text. No icon, no pill. |
| 4 | Verb on edit/delete | Stay "added"/"posted". Only the suffix flips. |
| 5 | Scope of kinds | **Badge suffix** (Edited / Deleted on the activity row): `expense_added`, `settlement_added`, `message_posted`. **Deletion-notice popup + kebab**: `expense_added` and `settlement_added` only (`FeedItemDetailSheet` is expense/settlement-shaped today; deleted message rows still get the suffix but tapping is a no-op for v1 — same as the row's current message-tap behavior). **Trigger DELETE→UPDATE switch**: all three kinds, so the data model stays consistent for any future message popup. |
| 6 | Edited + Deleted on same row | "Deleted" wins. The deletion-notice popup is shown; no "Edited" suffix is displayed once `is_deleted` is true. |
| 7 | Resurface on delete | Yes — bump `created_at = NOW()` on delete so the deleted row jumps to the top of the feed (matches edit behavior). |
| 8 | Kebab placement | Inside the detail popup only, only for deleted rows. The row itself gets no kebab. |
| 9 | Kebab menu contents | Single action: "Remove from activity". |
| 10 | Confirmation UX | Native `platformAlert` with Cancel / Remove, matching the existing delete-confirmation pattern in `GroupDetailScreen.tsx:624-676`. |
| 11 | Per-user hide implementation | `DELETE FROM activity_events WHERE id = $1 AND user_id = auth.uid()`. New RLS policy permits this. No cascading effects: source `expenses`/`settlements` row is already deleted. |
| 12 | Capturing the deleter | `auth.uid()` inside the trigger. Trigger functions are `SECURITY DEFINER` but `auth.uid()` reads JWT claims, so the calling user's id is returned. To be verified in implementation. |
| 13 | Backfill | None. Already-deleted activity rows are gone from the table and cannot be revived. Existing pre-migration edits don't show the badge. |
| 14 | i18n keys | `activity.edited`, `activity.deleted`, `activity.deletionNotice.expense`, `activity.deletionNotice.settlement`, `activity.removeFromActivity`, `activity.removeFromActivityConfirm`. |

## Data flow

### Edit
```
expenses / settlements / group_messages  (UPDATE: content change)
        │
        ▼
emit_*_activity_events trigger (existing ELSIF branch)
        │   UPDATE activity_events
        │   SET metadata = metadata || jsonb_build_object(
        │           ...new content fields...,
        │           'is_edited', true,
        │           'edited_at', NOW()
        │       ),
        │       created_at = NOW()
        │   WHERE kind = '...' AND ref_id = NEW.id;
        ▼
client reads metadata.is_edited → renders " · Edited"
```

### Delete
```
expenses / settlements / group_messages  (UPDATE: is_deleted/deleted_at flips)
        │
        ▼
emit_*_activity_events trigger (replaces today's DELETE branch)
        │   UPDATE activity_events
        │   SET metadata = metadata || jsonb_build_object(
        │           'is_deleted', true,
        │           'deleted_at', NOW(),
        │           'deleted_by', auth.uid()
        │       ),
        │       created_at = NOW()
        │   WHERE kind = '...' AND ref_id = NEW.id;
        ▼
client reads metadata.is_deleted → row stays, " · Deleted" suffix
on tap → FeedItemDetailSheet shows deletion-notice variant
"Remove from activity" → DELETE FROM activity_events WHERE id=$1 AND user_id=auth.uid()
```

Note: we use `metadata || jsonb_build_object(...)` (merge) so existing fields like `description`/`amount` are preserved on the row. The current edit-branch `jsonb_build_object(...)` *replaces* metadata wholesale — we keep that behavior in the edit branch (it intentionally captures the latest field values), but on delete we want to keep the last-known content so the popup can still render "Dinner — ₪120.00" inside the deletion notice. The delete branch therefore uses the merge form.

## Backend change

**New migration:** `cost-share-app/supabase/migrations/<YYYYMMDDhhmmss>_activity_events_edited_deleted_flags.sql`

1. `CREATE OR REPLACE` the three existing functions: `emit_expense_activity_events`, `emit_settlement_activity_events`, `emit_message_activity_events`.
   - **Edit branch (ELSIF UPDATE … content changed):** add `'is_edited', true, 'edited_at', NOW()` to the `jsonb_build_object` written into `metadata`. Triggers' column-watch lists already cover the relevant columns from migration `20260618110000`.
   - **Delete branch (IF UPDATE … is_deleted/deleted_at flips):** replace the existing `DELETE FROM activity_events …` with `UPDATE activity_events SET metadata = metadata || jsonb_build_object('is_deleted', true, 'deleted_at', NOW(), 'deleted_by', auth.uid()), created_at = NOW() WHERE kind = '…' AND ref_id = NEW.id;`
   - **Un-delete branch (UPDATE … is_deleted goes false → true and we want to revive):** intentionally untouched. Today this path INSERTs … ON CONFLICT DO NOTHING. With our change, the ON CONFLICT will find the now-soft-deleted-but-still-present row and skip the insert — so an un-deleted item would not return to the feed in updated form. Acceptable for v1: KupaPay does not expose un-delete in the UI. If un-delete is added later, the trigger can be extended to clear the `is_deleted` flag and refresh metadata.

2. Add the column-watch on the delete-detecting columns (`is_deleted` for expenses & messages, `deleted_at` for settlements) is already in the trigger from `20260618110000` — no change to the `CREATE TRIGGER` statements.

3. Add new RLS policy on `activity_events`:
   ```sql
   CREATE POLICY activity_events_delete_own
     ON public.activity_events
     FOR DELETE
     TO authenticated
     USING (user_id = auth.uid());
   ```

Migration safety:
- `CREATE OR REPLACE FUNCTION` is idempotent.
- The DELETE→UPDATE behavior change is **observable**: today's deletes vanish from `activity_events`; after this migration they persist with `is_deleted=true`. Rollback is straightforward (revert functions to the previous body, then optionally `DELETE FROM activity_events WHERE (metadata->>'is_deleted')::boolean IS TRUE` if cleanup is desired).
- The new RLS policy is purely additive.
- No data migration / backfill.

## Frontend changes

### `cost-share-app/apps/mobile/components/ActivityItem.tsx`
- Compute `const isDeleted = (event.metadata as Record<string, unknown>)?.is_deleted === true;`
- Compute `const isEdited = (event.metadata as Record<string, unknown>)?.is_edited === true;`
- In the existing `meta` `useMemo` (lines 88–101):
  - For `'expense_added' | 'settlement_added' | 'message_posted'`, append `' · ' + t('activity.deleted')` when `isDeleted`, else `' · ' + t('activity.edited')` when `isEdited`. Otherwise unchanged.
  - Other kinds: unchanged.
- Pressable: deleted rows are still pressable (they open the deletion-notice popup). No change to `pressable` logic.

### `cost-share-app/apps/mobile/screens/activity/ActivityFeedScreen.tsx`
- Read `metadata.is_deleted` in the `openExpenseDetail` / `openSettlementDetail` callbacks:
  - If deleted: skip the live `getExpenseWithSplitsById` / `getSettlementById` fetch (it would return null anyway). Build the same stub from metadata as today, then pass it into `FeedItemDetailSheet` along with the new `deletedNotice` prop.
  - `deletedNotice` carries `{ deletedAt: Date, deletedByName: string, kind: 'expense' | 'settlement' }`.
  - Look up `deletedByName` from the existing `profileMap` (the deleter's userId is in `metadata.deleted_by`). If not yet resolved, the `useEffect` profile-resolver loop is extended to include `deleted_by` (same pattern as the existing `from_user_id`, `to_user_id`, `new_member_user_id` resolution at lines 162–176).
- Add `onRemoveFromActivity` handler:
  - Calls `removeActivityEvent(event.id)`.
  - On success, invalidates `queryKeys.activityFeed` (whatever key `useActivityQuery` uses) and closes the popup.
  - Wraps in `platformAlert(t('activity.removeFromActivityConfirm'), undefined, [Cancel, Remove])`, matching `GroupDetailScreen.tsx:624-676`.

### `cost-share-app/apps/mobile/components/FeedItemDetailSheet.tsx`
- Add optional props:
  - `deletedNotice?: { deletedAt: Date; deletedByName: string; kind: 'expense' | 'settlement' }`
  - `onRemoveFromActivity?: () => void`
- When `deletedNotice` is set:
  - Body renders the localized deletion message instead of the splits/balances detail.
  - Edit/Delete icon buttons are hidden.
  - A kebab (`'ellipsis-vertical'` AppIcon) button is shown in the header.
  - Tapping the kebab opens an action sheet / popover with one item: "Remove from activity". Selecting it invokes `onRemoveFromActivity?.()`.
- When `deletedNotice` is not set: existing behavior unchanged.

### `cost-share-app/apps/mobile/services/activityEvents.service.ts` (new file, ~20 lines)
- `removeActivityEvent(eventId: string): Promise<boolean>` — supabase `.from('activity_events').delete().eq('id', eventId)`. Returns true on success. RLS guarantees the user can only delete their own row.

### `cost-share-app/apps/mobile/i18n/locales/en.json` & `he.json`
Add under the existing `"activity"` block:
- `"edited"`: `"Edited"` / `"נערך"`
- `"deleted"`: `"Deleted"` / `"נמחק"`
- `"deletionNotice.expense"`: `"This expense was deleted by {{name}} on {{when}}."` / `"ההוצאה הזו נמחקה על ידי {{name}} ב־{{when}}."` — `{{when}}` is formatted via the existing `formatFeedDateTime(deletedAt, language)` helper (same one used for the row meta line).
- `"deletionNotice.settlement"`: `"This payment was deleted by {{name}} on {{when}}."` / `"התשלום הזה נמחק על ידי {{name}} ב־{{when}}."` — same `formatFeedDateTime` formatting.
- `"removeFromActivity"`: `"Remove from activity"` / `"הסר מהפעילות"`
- `"removeFromActivityConfirm"`: `"Remove this from your activity?"` / `"להסיר את זה מהפעילות שלך?"`

(Hebrew strings are a starting point — translators can adjust copy in review.)

### `cost-share-app/packages/shared/src/types/index.ts`
- No required change. `metadata: Record<string, unknown>` already permits the new fields. We could optionally narrow with an `ActivityEventMetadata` discriminated union, but that's out of scope here.

## Push notifications

The trigger pipeline is already in place from migration `20260618110000`:
- INSERT path: `trg_push_send_on_activity_event` → `app_private.push_send_on_activity_event` → `send-push` edge function.
- UPDATE path (only when `created_at` changes): `trg_push_send_on_activity_event_update` → same handler.

Both edits and deletes bump `created_at`, so both already fire the existing UPDATE trigger. The only missing piece is **per-state copy** in the edge function — today it renders all of them as "New expense from …".

### `cost-share-app/supabase/functions/send-push/render.ts`
- Extend `RenderParams` with optional flags:
  ```ts
  isEdited?: boolean;
  isDeleted?: boolean;
  ```
- For `expense_added`, `settlement_added`, `message_posted`, branch on `isDeleted` first (wins), then `isEdited`, else current behavior. Title stays as `groupName` (or `actorName · groupName` for messages). Body changes:

  | kind | state | en body | he body |
  |---|---|---|---|
  | `expense_added` | added | `New expense from {actor} · {desc} · {money}` (unchanged) | `הוצאה חדשה מאת {actor} · {desc} · {money}` (unchanged) |
  | `expense_added` | edited | `{actor} updated an expense · {desc} · {money}` | `{actor} עדכן הוצאה · {desc} · {money}` |
  | `expense_added` | deleted | `{actor} deleted an expense · {desc}` | `{actor} מחק הוצאה · {desc}` |
  | `settlement_added` | added | `New payment from {actor} · {money}` (unchanged) | `תשלום חדש מאת {actor} · {money}` (unchanged) |
  | `settlement_added` | edited | `{actor} updated a payment · {money}` | `{actor} עדכן תשלום · {money}` |
  | `settlement_added` | deleted | `{actor} deleted a payment` | `{actor} מחק תשלום` |
  | `message_posted` | added | body = message body (unchanged) | (unchanged) |
  | `message_posted` | edited | `{actor} edited a message`, title = `{actor} · {group}` | `{actor} ערך הודעה`, title = `{actor} · {group}` |
  | `message_posted` | deleted | `{actor} deleted a message` | `{actor} מחק הודעה` |

  Edited message push deliberately does not include the new body, to avoid double-notifying with the message content. The actor sees their own edit in the source thread.

### `cost-share-app/supabase/functions/send-push/handler.ts`
- Read `md.is_edited` and `md.is_deleted` (lines 91–100) and pass them through as `isEdited` / `isDeleted` to `renderNotification`.

### `cost-share-app/supabase/functions/send-push/handler.test.ts`
- Add coverage for the six new branches above (expense/settlement/message × edited/deleted) in both `en` and `he`.

### Deployment
- After the migration lands and the `send-push` function is updated, redeploy the edge function:
  ```
  supabase functions deploy send-push
  ```
  This is documented in the PR description so the deploy step isn't missed.

### Suppressing self-push
The existing `WHEN` clauses on both push triggers (`NEW.actor_user_id IS NOT NULL AND NEW.actor_user_id IS DISTINCT FROM NEW.user_id`) already prevent the actor from receiving their own edit/delete push. No change needed.

## UX details

- Edited row: `Avi · 2:14 PM · Edited` — muted text, same line, no icon/pill.
- Deleted row: `Avi · 2:14 PM · Deleted` — same styling. Pressable.
- Deletion popup:
  - Header: same compact header (kind label, group name, kebab icon button).
  - Body: stub data (last-known description/amount/parties) + a clear notice "This expense was deleted by Avi on Jun 18, 2:14 PM" — uses the user's locale for date/time.
  - No Edit/Delete icon buttons.
- Kebab tap: action sheet with a single destructive-styled "Remove from activity" item.
- Remove confirmation: native alert ("Remove this from your activity?") with Cancel + Remove.
- After removal: popup closes, the row disappears from the list, no toast (matches in-app delete UX).
- RTL: all suffixes go through `t(...)` and sit inside the existing single-string meta. No layout change.

## Testing

**Unit (Jest, mobile).**
Extend `__tests__/components/ActivityItem.test.tsx`:
- `expense_added` with `is_edited: true` → meta contains "Edited".
- `expense_added` with `is_deleted: true` → meta contains "Deleted".
- `expense_added` with both flags true → meta contains "Deleted", not "Edited".
- `settlement_added` and `message_posted` parallels for the two states.
- Non-editable kinds with `is_edited`/`is_deleted` set defensively → suffix absent.

Extend or add `__tests__/components/FeedItemDetailSheet.test.tsx`:
- `deletedNotice` prop set → deletion message visible, Edit/Delete buttons absent, kebab visible.
- Kebab → tap "Remove from activity" → invokes `onRemoveFromActivity`.

**i18n.** Existing parity test covers the new keys automatically.

**Backend (manual, in PR test plan).**
1. Edit an expense → row reappears at top with "Edited" inline; DB `metadata.is_edited = true`; other group members receive a push titled the group name with body "Avi updated an expense · Dinner · ₪120".
2. Edit a settlement / message → same (with the matching push body).
3. Delete an expense → row stays in feed with "Deleted" suffix; jumps to top; DB `metadata.is_deleted = true, deleted_by = <uid>`; other group members receive a push "Avi deleted an expense · Dinner".
4. Tap deleted row → popup shows deletion notice with deleter's name and time. No Edit/Delete buttons. Kebab present.
5. Kebab → "Remove from activity" → confirmation → row removed from this user's feed only (other group members still see it).
6. Edit then delete → final state is "Deleted" (precedence).
7. Editing/deleting your own item does NOT send a push to you (existing actor=user suppression).

**Edge function (`handler.test.ts`).** Six new cases: `expense_added`/`settlement_added`/`message_posted` × `isEdited`/`isDeleted`, in both `en` and `he`.

## Open questions

None at design time.

## Files touched (summary)

- **New.**
  - `cost-share-app/supabase/migrations/<YYYYMMDDhhmmss>_activity_events_edited_deleted_flags.sql`
  - `cost-share-app/apps/mobile/services/activityEvents.service.ts`
- **Modified.**
  - `cost-share-app/apps/mobile/components/ActivityItem.tsx`
  - `cost-share-app/apps/mobile/components/FeedItemDetailSheet.tsx`
  - `cost-share-app/apps/mobile/screens/activity/ActivityFeedScreen.tsx`
  - `cost-share-app/apps/mobile/i18n/locales/en.json`
  - `cost-share-app/apps/mobile/i18n/locales/he.json`
  - `cost-share-app/apps/mobile/__tests__/components/ActivityItem.test.tsx`
  - `cost-share-app/apps/mobile/__tests__/components/FeedItemDetailSheet.test.tsx`
  - `cost-share-app/supabase/functions/send-push/render.ts`
  - `cost-share-app/supabase/functions/send-push/handler.ts`
  - `cost-share-app/supabase/functions/send-push/handler.test.ts`
