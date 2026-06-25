# Design: Expanded activity coverage — group lifecycle, friend rejection, and unread-note dot

**Date:** 2026-06-25
**Status:** Approved (pending spec review)

## Goal

Make the in-app activity feed a fuller history by recording user actions that are
currently silent, and add an unread indicator for group-note changes. Specifically:

1. **`group_created`** — record when a group is created.
2. **`group_deleted`** — record when a group is deleted, visible to all members.
3. **`group_note_changed`** — record + push when a group's shared note changes.
4. **Friend request rejected** — record on both sides (reuses existing kind).
5. **Unread-note dot** — an orange dot on the note button that appears when the
   note has changed and clears once the user opens the note.

Out of scope: group rename / image / currency / type edits, group archive/unarchive,
profile edits, invite link rotation/redemption events. (Discussed and deferred.)

## Background / current architecture

Activity flows: source-table triggers fan out one row per recipient into
`activity_events` → an `AFTER INSERT`/`UPDATE` webhook trigger
(`20260611132000_push_webhook_trigger.sql`) posts to the `send-push` edge
function → `render.ts` builds the push copy.

- `activity_events.kind` is `TEXT NOT NULL CHECK (kind IN (...))`
  (`20260526105507_activity_events.sql:39`). New kinds require widening the CHECK.
- **Self-suppression** is automatic: the webhook fires only
  `WHEN (NEW.actor_user_id IS NOT NULL AND NEW.actor_user_id IS DISTINCT FROM NEW.user_id)`.
  So any event where actor == recipient never pushes.
- Feed copy: `apps/mobile/i18n/locales/{en,he}.json` + title resolution in
  `ActivityItemCard.tsx` / `ActivityItem.tsx`.
- Push copy: `supabase/functions/send-push/locales/{en,he}.json` + `render.ts`.
- Tap navigation: `ActivityFeedScreen.tsx` `handleActivityPress` switch. It already
  guards `if (event.groupId && groupsLoaded && !knownGroupIds.has(event.groupId)) → showUnavailableToast()`.
- Existing "seen" patterns: a global `profiles.activity_last_seen_at` + `mark_activity_seen`
  RPC for the feed; per-group background hydration via `get_user_groups_archive_state`
  (`fetchGroupsArchiveState` / `hydrateGroupsArchiveStateInBackground`).
- Groups load via `fetchGroups` → `select('*, group_members!inner(user_id, is_active, profiles(...)))'`.
- Group note: stored in `groups.note`; edited in `GroupNoteScreen` (autosave, realtime);
  opened from `SummaryFooter`/`GroupSummaryCard` `onOpenNote` → `navigation.navigate('GroupNote', { groupId })`.
- Group delete is a soft delete: `groups.service.ts deleteGroup` does
  `.update({ is_active: false })` (no captured deleter column → use `auth.uid()` in trigger).

## Detailed design

### 1. `group_created`
- **Trigger:** `AFTER INSERT ON groups` when `NEW.is_active = true`. Insert one event:
  `user_id = actor_user_id = NEW.created_by`, `group_id = NEW.id`, `ref_id = NEW.id`,
  `metadata = { group_name }`.
- **Audience:** creator only (sole member at creation).
- **Push:** none — self-action, blocked by existing self-suppression.
- **Feed copy:** EN "You created the group {group}". HE equivalent.
- **Tap:** opens the group; missing → unavailable toast (existing `knownGroupIds` guard,
  then falls through to the existing `if (event.groupId)` → GroupDetail navigation).

### 2. `group_deleted`
- **Trigger:** `AFTER UPDATE ON groups` when `OLD.is_active = true AND NEW.is_active = false`.
  Fan out one event per still-active member (`group_members` where `is_active = true`):
  `user_id = gm.user_id`, `actor_user_id = auth.uid()` (the deleter), `group_id = NEW.id`,
  `ref_id = NEW.id`, `metadata = { group_name }`.
- **Audience:** everyone. Deleter: actor == user → "You deleted the group {group}".
  Others: actor != user → "{actor} deleted the group {group}".
- **Push:** to every member except the deleter (self-suppression handles the deleter).
- **Feed copy:** EN self "You deleted the group {group}" / other "{actor} deleted the group {group}".
- **Push copy:** `render.ts` case `group_deleted` → title = group name, body = "{actor} deleted the group".
- **Tap:** group no longer exists → existing `knownGroupIds` guard shows unavailable toast.
- **Pressable:** ensure `group_deleted` is pressable (current code excludes only `group_removed`
  in `ActivityItem.tsx:48`; `group_deleted` is therefore already pressable — verify).

### 3. `group_note_changed`
- **Trigger:** `AFTER UPDATE ON groups` when `NEW.is_active = true AND NEW.note IS DISTINCT FROM OLD.note`.
  Fan out one event per active member: `user_id = gm.user_id`, `actor_user_id = auth.uid()`,
  `group_id = NEW.id`, `ref_id = NEW.id`, `metadata = { group_name }`.
  Only the `note` column triggers this — other column edits stay silent.
- **Audience:** everyone. Actor: "You changed the note in {group}". Others:
  "{actor} changed the note in {group}".
- **Push:** to everyone except the actor.
- **Feed copy / push copy:** added to both locale sets + `render.ts` case `group_note_changed`.
- **Tap:** opens the GroupNote screen —
  `navigation.navigate('Groups', { screen: 'GroupNote', params: { groupId } })`;
  missing group → unavailable toast.

### 4. Friend request rejected
- **Reuses** existing `friend_request_received` kind with `metadata.status = 'rejected'`
  (the feed card already renders a rejected branch: `ActivityItemCard.tsx:47`).
- **Trigger change:** extend the existing `friend_requests` trigger so that on
  status → `'rejected'` it mirrors the existing `'accepted'` flow: the recipient's
  existing event metadata updates in place, AND a new event is inserted for the
  **sender** (`user_id = from_user_id`, `actor_user_id = to_user_id` = the rejecter).
- **Audience:** both sides. Rejecter: "You declined {actor}'s friend request".
  Sender: "{actor} declined your friend request".
- **Push:** to the **sender only**. The sender's new event has `actor = rejecter`
  (not self), so the existing self-suppression lets it push. The rejecter's own event
  updates in place (no `created_at` change → the update webhook does not fire), so the
  rejecter is not pushed. No special skip guard needed.
- **Feed copy:** distinct EN/HE strings for the rejecter-perspective and sender-perspective
  (resolved by comparing `actorUserId`/`userId` to `currentUserId` in title resolution).
- **Push copy:** `render.ts` `friend_request_received` must branch on `metadata.status`
  to render the rejected-status push body ("{actor} declined your friend request") in
  addition to the existing pending/accepted copy. Add the strings to
  `send-push/locales/{en,he}.json`.
- **Tap:** opens Friends screen (already wired in `handleActivityPress`).

### 5. Unread-note dot

**Data model (per user, per group "last read the note"):**
- New column `groups.note_updated_at timestamptz NULL`.
- New column `group_members.note_seen_at timestamptz NULL`.
- **Unread** = `note_updated_at IS NOT NULL AND (note_seen_at IS NULL OR note_seen_at < note_updated_at)`.

**Stamping (shares the note-change detection from #3):** a `BEFORE UPDATE ON groups`
trigger sets `NEW.note_updated_at = now()` when `NEW.note IS DISTINCT FROM OLD.note`.
The **same `AFTER UPDATE` trigger function that fans out the `group_note_changed`
events** additionally marks the editor's row read, in one statement, so they never see
their own dot:
`UPDATE group_members SET note_seen_at = now() WHERE group_id = NEW.id AND user_id = auth.uid()`.
Net effect: editor read, every other member unread.

**Clearing:** new RPC `mark_group_note_seen(p_group_id)` sets the caller's
`group_members.note_seen_at = now()`. The **GroupNote screen calls it on mount**, so
the dot clears whether the user opened the note intentionally or via the push deep-link
(both land on GroupNote). On success, invalidate the groups query so the dot updates.

**Surfacing:** `note_updated_at` arrives for free via `fetchGroups`'s `select('*')`.
Add `note_seen_at` to the `group_members!inner(...)` projection; compute
`hasUnreadNote` from the current user's member row in `groupWithMembersFromRow`.

**UI:** orange dot (theme accent/warning color) on the note button —
`onOpenNote` affordance in `SummaryFooter` / `GroupSummaryCard`. Scope: note button only
(not the groups-list card).

## Cross-cutting work

- **Migration(s):** widen `activity_events` CHECK to add `group_created`,
  `group_deleted`, `group_note_changed`; add `groups.note_updated_at` and
  `group_members.note_seen_at`; add the three `groups` triggers (created / deleted /
  note-changed + note_updated_at stamp); extend the friend-request trigger for rejection;
  add the reject push-skip guard to the webhook trigger; add `mark_group_note_seen` RPC.
- **Edge function:** `render.ts` + `send-push/locales/{en,he}.json` — add `group_deleted`
  and `group_note_changed`; branch `friend_request_received` on `metadata.status` for the
  rejected push body; extend the `ActivityKind` type union with all new kinds.
- **Shared types:** extend `ActivityEventKind` in `@cost-share/shared`.
- **Mobile:** `ActivityItemCard.tsx` title resolution for the four new/extended cases;
  `handleActivityPress` GroupNote case; `groups.service.ts` (`note_seen_at` in select +
  `hasUnreadNote` computation + `markGroupNoteSeen` service fn); `GroupNoteScreen` mount
  effect calls `mark_group_note_seen`; dot in `SummaryFooter`/`GroupSummaryCard`;
  `apps/mobile/i18n/locales/{en,he}.json`.

## Testing

- DB trigger behavior: group create/delete/note-change emit the expected rows with
  correct actor/recipient; friend rejection inserts the sender event + updates recipient;
  note edit stamps `note_updated_at` and marks editor seen.
- `render.ts` unit tests for `group_deleted` / `group_note_changed` / rejected
  `friend_request_received` push body (EN + HE).
- Push targeting: friend rejection pushes the sender (actor != recipient) but not the
  rejecter (in-place update, no `created_at` change → no webhook fire).
- `ActivityItemCard` title tests for the four cases (self vs other perspective).
- Unread-note: `hasUnreadNote` true after a non-actor's change, false for the actor,
  false after `mark_group_note_seen`.

## Open assumptions (call out if wrong)

- Friend rejection pushes the **sender** ("{actor} declined your friend request"); the
  rejecter is not pushed. (Every new event pushes unless it is the actor's own action.)
- The friend-rejection push depends on the rejecter's in-place event NOT bumping
  `created_at`. **Verified:** the UPDATE webhook (`20260618110000_activity_events_fire_on_edit.sql`)
  fires only when `created_at` changes, explicitly to "avoid duplicate push for
  friend-request status updates, which UPDATE metadata but leave created_at alone." So
  the rejecter is provably not pushed; no extra guard needed.
- Group note `BEFORE UPDATE` stamping coexists cleanly with the existing autosave/realtime
  on the groups row (note edits already write `groups.note`).
- `groups.note` column exists in production (the app reads/writes it via `updateGroup` /
  `GroupNoteScreen`) even though it predates the migrations in this repo snapshot — verify
  the column + add it if the baseline is missing.
