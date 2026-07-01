# Activity coverage: group lifecycle, friend rejection, unread-note dot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record `group_created`, `group_deleted`, `group_note_changed`, and friend-request *rejection* in the activity feed (with matching push notifications for non-self actions), and show an orange unread dot on the group note button until the user opens the note.

**Architecture:** Follows the established `activity_events` pipeline: source-table triggers fan out one row per recipient → the `AFTER INSERT/UPDATE` push webhook (`20260611132000` / `20260618110000`) posts to the `send-push` edge function → `render.ts` builds copy. Self-actions never push (the webhook fires only when `actor_user_id IS DISTINCT FROM user_id`). The unread-note dot adds `groups.note_updated_at` + `group_members.note_seen_at` and a `mark_group_note_seen` RPC, surfaced through the existing `fetchGroups` query.

**Tech Stack:** Postgres (Supabase migrations + SQL `__tests__` run via Supabase MCP `execute_sql`), Deno edge functions (`std/assert` tests), React Native + TypeScript (Jest), i18n via `react-i18next`, shared types in `@cost-share/shared`.

## Global Constraints

- **Self-suppression is automatic** — never push when `actor_user_id = user_id`; rely on the existing webhook `WHEN` clause, do not re-implement it.
- **`activity_events.kind`** is `TEXT` with `CHECK (kind IN (...))` (no enum); widening requires drop+add of constraint `activity_events_kind_check`.
- **Two independent locale sets:** mobile feed copy lives in `apps/mobile/i18n/locales/{en,he}.json`; push copy lives in `supabase/functions/send-push/locales/{en,he}.json`.
- **Two independent kind unions:** `ActivityEventKind` in `packages/shared/src/types/index.ts`, and `ActivityKind` in `supabase/functions/send-push/render.ts`. Keep both in sync.
- **Push category gating:** the edge `handler.ts` `KIND_TO_PREF` map (Record over every kind) must include every new kind → `'groups_push'` / `'friends_push'`.
- **Copy wording (verbatim, EN):** "Group {group} created by you" · "Group {group} deleted by you" / "Group {group} deleted by {name}" · "Note changed by you · {group}" / "Note changed by {name} · {group}" · rejecter sees "You declined {name}'s friend request" (existing key) / sender sees "{name} declined your friend request".
- **No group-detail / note-screen attribution row** — the changer's name appears only in the activity feed and push. No `note_updated_by` column.
- **Orange dot color:** `colors.warning` (`#F59E0B`).
- **SQL tests** run inside `BEGIN; SET LOCAL session_replication_role = replica; ... ROLLBACK;` and must `ALTER TABLE ... ENABLE ALWAYS TRIGGER` the triggers under test. Simulate the actor with `SET LOCAL request.jwt.claims = '{"sub":"<uuid>"}'` so `auth.uid()` resolves inside the transaction.
- **Migration env:** new migration goes in `cost-share-app/supabase/migrations/`. Dev project ref `drxfbicunusmipdgbgdk`; do not target prod.

---

## File Structure

- **Create** `cost-share-app/supabase/migrations/20260625130000_activity_group_friend_events.sql` — schema (CHECK widen, two new columns), three `groups` triggers, friend-reject trigger extension, `mark_group_note_seen` RPC.
- **Create** `cost-share-app/supabase/__tests__/group_friend_activity_events.test.sql` — SQL regression tests for the new triggers + RPC.
- **Modify** `cost-share-app/supabase/functions/send-push/render.ts` — `ActivityKind` union, `Messages` interface, `RenderParams.status`, new `switch` cases.
- **Modify** `cost-share-app/supabase/functions/send-push/handler.ts` — `KIND_TO_PREF` entries; pass `status` into `renderNotification`.
- **Modify** `cost-share-app/supabase/functions/send-push/locales/{en,he}.json` — push copy.
- **Modify** `cost-share-app/supabase/functions/send-push/render.test.ts` — render tests.
- **Modify** `cost-share-app/packages/shared/src/types/index.ts` — `ActivityEventKind`; `Group.noteUpdatedAt`; `GroupWithMembers.hasUnreadNote`.
- **Modify** `cost-share-app/packages/shared/src/notifications/content.ts` — `KIND_TO_CATEGORY` entries.
- **Modify** `cost-share-app/packages/shared/src/mappers/index.ts` — `groupFromRow` maps `note_updated_at`; `groupWithMembersFromRow` defaults `hasUnreadNote: false`.
- **Modify** `cost-share-app/apps/mobile/i18n/locales/{en,he}.json` — feed copy keys.
- **Modify** `cost-share-app/apps/mobile/components/ActivityItemCard.tsx` — `resolveActivityTitle` cases + reject perspective.
- **Modify** `cost-share-app/apps/mobile/components/ActivityItem.tsx` — meta/timestamp for new kinds.
- **Modify** `cost-share-app/apps/mobile/screens/activity/ActivityFeedScreen.tsx` — `group_note_changed` → GroupNote navigation.
- **Modify** `cost-share-app/apps/mobile/services/groups.service.ts` — `note_seen_at` in select, compute `hasUnreadNote`, `markGroupNoteSeen`.
- **Modify** `cost-share-app/apps/mobile/screens/groups/GroupNoteScreen.tsx` — call `markGroupNoteSeen` on mount.
- **Modify** `cost-share-app/apps/mobile/components/groupDetail/{GroupSummaryCard,SummaryFooter}.tsx` — thread `noteHasUnread` + render dot.
- **Modify** `cost-share-app/apps/mobile/screens/groups/GroupDetailScreen.tsx` — pass `noteHasUnread`.
- **Modify** `cost-share-app/apps/mobile/__tests__/components/ActivityItemCard.test.tsx` + a SummaryFooter test.

---

## Task 1: Shared types + push-category map

**Files:**
- Modify: `cost-share-app/packages/shared/src/types/index.ts:232-239` (kind union), `:41-54` (Group), `:507-514` (GroupWithMembers)
- Modify: `cost-share-app/packages/shared/src/notifications/content.ts:25-33`
- Modify: `cost-share-app/packages/shared/src/mappers/index.ts:38-51`, `:83-88`
- Test: `cost-share-app/packages/shared/src/notifications/content.ts` is data; verify via `tsc` build + a tiny content test if a test dir exists, else build only.

**Interfaces:**
- Produces: `ActivityEventKind` now includes `'group_created' | 'group_deleted' | 'group_note_changed'`; `Group.noteUpdatedAt?: Date`; `GroupWithMembers.hasUnreadNote: boolean`; `KIND_TO_CATEGORY` covers the new kinds.

- [ ] **Step 1: Extend the kind union**

In `packages/shared/src/types/index.ts`, replace the `ActivityEventKind` body (lines 232-239):

```ts
export type ActivityEventKind =
    | 'expense_added'
    | 'settlement_added'
    | 'message_posted'
    | 'friend_request_received'
    | 'group_added'
    | 'group_member_joined'
    | 'group_removed'
    | 'group_created'
    | 'group_deleted'
    | 'group_note_changed';
```

- [ ] **Step 2: Add note fields to Group / GroupWithMembers**

In the same file, add to `interface Group` (after `note?: string;` at line 45):

```ts
    /** When the shared note last changed; drives the unread-note dot. */
    noteUpdatedAt?: Date;
```

And add to `interface GroupWithMembers` (after `isAutoArchived: boolean;`):

```ts
    /** True when the note changed since the caller last opened it. */
    hasUnreadNote: boolean;
```

- [ ] **Step 3: Map the new column + default the flag**

In `packages/shared/src/mappers/index.ts`, add to the `groupFromRow` object (after `note:` at line 42):

```ts
    noteUpdatedAt: r.note_updated_at ? toDate(r.note_updated_at) : undefined,
```

And in `groupWithMembersFromRow`'s returned object (lines 83-88), add `hasUnreadNote: false` (the service computes the real value per current user):

```ts
    return {
        ...groupFromRow(r),
        members,
        isArchivedByMe: false,
        isAutoArchived: false,
        hasUnreadNote: false,
    };
```

- [ ] **Step 4: Add KIND_TO_CATEGORY entries**

In `packages/shared/src/notifications/content.ts`, extend `KIND_TO_CATEGORY` (lines 25-33):

```ts
export const KIND_TO_CATEGORY: Record<ActivityEventKind, ActivityCategory> = {
    expense_added: 'expenses',
    settlement_added: 'settlements',
    message_posted: 'messages',
    friend_request_received: 'friends',
    group_added: 'groups',
    group_member_joined: 'groups',
    group_removed: 'groups',
    group_created: 'groups',
    group_deleted: 'groups',
    group_note_changed: 'groups',
};
```

- [ ] **Step 5: Build the shared package to verify exhaustiveness**

Run: `cd cost-share-app && npm run build -w @cost-share/shared` (or `npx tsc -p packages/shared`)
Expected: PASS. If `KIND_TO_CATEGORY` is missing a kind, TS errors `Property 'group_created' is missing` — that confirms the Record type is enforcing coverage.

- [ ] **Step 6: Commit**

```bash
git add cost-share-app/packages/shared/src
git commit -m "feat(shared): add group_created/deleted/note_changed kinds + note unread fields"
```

---

## Task 2: Edge function — render, prefs, locales, tests

**Files:**
- Modify: `cost-share-app/supabase/functions/send-push/render.ts:6-8` (type), `:10-20` (RenderParams), `:26-34` (Messages), `:56-89` (switch)
- Modify: `cost-share-app/supabase/functions/send-push/handler.ts:47-55` (KIND_TO_PREF), `:91-102` (render call)
- Modify: `cost-share-app/supabase/functions/send-push/locales/en.json`, `locales/he.json`
- Test: `cost-share-app/supabase/functions/send-push/render.test.ts`

**Interfaces:**
- Consumes: `ActivityEventKind` semantics from Task 1 (independent union, kept in sync).
- Produces: `renderNotification(kind, lang, { ..., status })` handles `group_deleted`, `group_note_changed`, `group_created`, and rejected `friend_request_received`.

- [ ] **Step 1: Write failing render tests**

Append to `supabase/functions/send-push/render.test.ts`:

```ts
Deno.test('group_deleted renders en/he with group title', () => {
    assertEquals(
        renderNotification('group_deleted', 'en', { actorName: 'Alice', groupName: 'Trip' }),
        { title: 'Trip', body: 'Deleted by Alice' },
    );
    assertEquals(
        renderNotification('group_deleted', 'he', { actorName: 'דנה', groupName: 'טיול' }),
        { title: 'טיול', body: 'נמחקה על ידי דנה' },
    );
});

Deno.test('group_note_changed renders en/he', () => {
    assertEquals(
        renderNotification('group_note_changed', 'en', { actorName: 'Alice', groupName: 'Trip' }),
        { title: 'Trip', body: 'Note changed by Alice' },
    );
    assertEquals(
        renderNotification('group_note_changed', 'he', { actorName: 'דנה', groupName: 'טיול' }),
        { title: 'טיול', body: 'הפתק שונה על ידי דנה' },
    );
});

Deno.test('friend_request_received rejected uses rejected push copy', () => {
    assertEquals(
        renderNotification('friend_request_received', 'en', { actorName: 'Bob', groupName: '', status: 'rejected' }),
        { title: 'Friend request declined', body: 'Bob declined your friend request' },
    );
});

Deno.test('friend_request_received pending unchanged', () => {
    assertEquals(
        renderNotification('friend_request_received', 'en', { actorName: 'Dana', groupName: '' }),
        { title: 'New friend request', body: 'Dana wants to connect' },
    );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd cost-share-app/supabase/functions/send-push && deno test render.test.ts`
Expected: FAIL — `group_deleted` not assignable to `ActivityKind` / missing locale keys.

- [ ] **Step 3: Add push locale copy (en)**

In `supabase/functions/send-push/locales/en.json`, change the `friend_request_received` object and add the two group entries:

```json
    "friend_request_received": {
        "title": "New friend request",
        "body": "{actor} wants to connect",
        "rejectedTitle": "Friend request declined",
        "rejectedBody": "{actor} declined your friend request"
    },
    "group_added": {
        "title": "You were added to a group",
        "body": "{actor} added you"
    },
    "group_member_joined": "{member} joined the group",
    "group_removed": "You were removed from the group",
    "group_created": "Group created",
    "group_deleted": "Deleted by {actor}",
    "group_note_changed": "Note changed by {actor}"
```

- [ ] **Step 4: Add push locale copy (he)**

In `supabase/functions/send-push/locales/he.json`, mirror it:

```json
    "friend_request_received": {
        "title": "בקשת חברות חדשה",
        "body": "{actor} רוצה להתחבר איתך",
        "rejectedTitle": "בקשת חברות נדחתה",
        "rejectedBody": "{actor} דחה/תה את בקשת החברות שלך"
    },
    "group_added": {
        "title": "צורפת לקבוצה",
        "body": "על ידי {actor}"
    },
    "group_member_joined": "{member} הצטרף/ה לקבוצה",
    "group_removed": "הוסרת מהקבוצה",
    "group_created": "קבוצה נוצרה",
    "group_deleted": "נמחקה על ידי {actor}",
    "group_note_changed": "הפתק שונה על ידי {actor}"
```

- [ ] **Step 5: Extend render.ts types**

In `render.ts`, extend the `ActivityKind` union (lines 6-8):

```ts
export type ActivityKind =
    | 'expense_added' | 'settlement_added' | 'message_posted'
    | 'friend_request_received' | 'group_added' | 'group_member_joined' | 'group_removed'
    | 'group_created' | 'group_deleted' | 'group_note_changed';
```

Add `status` to `RenderParams` (inside the interface, after `isDeleted?: boolean;`):

```ts
    status?: string | null;
```

Extend the `Messages` interface (lines 26-34):

```ts
interface Messages {
    expense_added: Record<Variant, string>;
    settlement_added: Record<Variant, string>;
    message_posted: { edited: string; deleted: string };
    friend_request_received: { title: string; body: string; rejectedTitle: string; rejectedBody: string };
    group_added: { title: string; body: string };
    group_member_joined: string;
    group_removed: string;
    group_created: string;
    group_deleted: string;
    group_note_changed: string;
}
```

- [ ] **Step 6: Add render switch cases**

In `render.ts`, replace the `friend_request_received` case and add the three group cases (within the `switch (kind)` block):

```ts
        case 'friend_request_received':
            if (p.status === 'rejected') {
                return { title: t.friend_request_received.rejectedTitle, body: interpolate(t.friend_request_received.rejectedBody, vars) };
            }
            return { title: t.friend_request_received.title, body: interpolate(t.friend_request_received.body, vars) };
        case 'group_added':
            return { title: t.group_added.title, body: joinDot([interpolate(t.group_added.body, vars), p.groupName]) };
        case 'group_member_joined':
            return { title: p.groupName, body: interpolate(t.group_member_joined, vars) };
        case 'group_removed':
            return { title: p.groupName, body: interpolate(t.group_removed, vars) };
        case 'group_created':
            return { title: p.groupName, body: interpolate(t.group_created, vars) };
        case 'group_deleted':
            return { title: p.groupName, body: interpolate(t.group_deleted, vars) };
        case 'group_note_changed':
            return { title: p.groupName, body: interpolate(t.group_note_changed, vars) };
```

- [ ] **Step 7: Pass status + add prefs entries in handler.ts**

In `handler.ts`, extend `KIND_TO_PREF` (lines 47-55) with the three new kinds:

```ts
    group_added: 'groups_push',
    group_member_joined: 'groups_push',
    group_removed: 'groups_push',
    group_created: 'groups_push',
    group_deleted: 'groups_push',
    group_note_changed: 'groups_push',
```

And in the `renderNotification(record.kind, lang, { ... })` call (lines 92-102), add:

```ts
        status: (md.status as string | undefined) ?? null,
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd cost-share-app/supabase/functions/send-push && deno test render.test.ts handler.test.ts`
Expected: PASS (all existing + new tests).

- [ ] **Step 9: Commit**

```bash
git add cost-share-app/supabase/functions/send-push
git commit -m "feat(push): render group_deleted/note_changed + friend-reject push copy"
```

---

## Task 3: Database migration + SQL tests

**Files:**
- Create: `cost-share-app/supabase/migrations/20260625130000_activity_group_friend_events.sql`
- Create: `cost-share-app/supabase/__tests__/group_friend_activity_events.test.sql`

**Interfaces:**
- Produces: triggers emitting `group_created` (creator), `group_deleted` (all members, actor = deleter), `group_note_changed` (all members, actor = editor); friend-reject sender row + recipient in-place update carrying `metadata.responder_user_id`; `mark_group_note_seen(p_group_id uuid)` RPC; columns `groups.note_updated_at`, `group_members.note_seen_at`.
- Consumes (mobile, Task 5): the `note_updated_at` / `note_seen_at` columns and `mark_group_note_seen`.

- [ ] **Step 1: Write the migration — schema + CHECK widening**

Create `supabase/migrations/20260625130000_activity_group_friend_events.sql`:

```sql
-- Expand activity coverage: group_created / group_deleted / group_note_changed,
-- friend-request rejection (both sides), and the unread-note dot plumbing.

-- 1. Widen the kind CHECK constraint.
ALTER TABLE activity_events DROP CONSTRAINT IF EXISTS activity_events_kind_check;
ALTER TABLE activity_events ADD CONSTRAINT activity_events_kind_check CHECK (kind IN (
    'expense_added',
    'settlement_added',
    'message_posted',
    'friend_request_received',
    'group_added',
    'group_member_joined',
    'group_removed',
    'group_created',
    'group_deleted',
    'group_note_changed'
));

-- 2. Unread-note columns.
ALTER TABLE groups         ADD COLUMN IF NOT EXISTS note_updated_at TIMESTAMPTZ;
ALTER TABLE group_members  ADD COLUMN IF NOT EXISTS note_seen_at    TIMESTAMPTZ;
```

- [ ] **Step 2: Add the note_updated_at stamp trigger (BEFORE UPDATE)**

Append:

```sql
-- 3. Stamp note_updated_at whenever the note text actually changes.
CREATE OR REPLACE FUNCTION stamp_group_note_updated_at() RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    BEGIN
        IF NEW.note IS DISTINCT FROM OLD.note THEN
            NEW.note_updated_at := NOW();
        END IF;
        RETURN NEW;
    END;
    $$;

DROP TRIGGER IF EXISTS trg_stamp_group_note_updated_at ON groups;
CREATE TRIGGER trg_stamp_group_note_updated_at
    BEFORE UPDATE OF note ON groups
    FOR EACH ROW EXECUTE FUNCTION stamp_group_note_updated_at();
```

- [ ] **Step 3: Add the group activity fan-out trigger (AFTER INSERT/UPDATE)**

Append:

```sql
-- 4. Group lifecycle activity events: created / deleted / note_changed.
CREATE OR REPLACE FUNCTION emit_group_activity_events() RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
        v_actor UUID := auth.uid();
    BEGIN
        -- group_created: one row for the creator (self-action → never pushes).
        IF TG_OP = 'INSERT' AND NEW.is_active = true THEN
            INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata, created_at)
            VALUES (
                NEW.created_by, 'group_created', NEW.id, NEW.id, NEW.created_by,
                jsonb_build_object('group_name', NEW.name), NOW()
            )
            ON CONFLICT (user_id, kind, ref_id) DO NOTHING;
            RETURN NEW;
        END IF;

        IF TG_OP = 'UPDATE' THEN
            -- group_deleted: soft delete → fan out to every active member.
            IF OLD.is_active = true AND NEW.is_active = false THEN
                INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata, created_at)
                SELECT gm.user_id, 'group_deleted', NEW.id, gen_random_uuid(), v_actor,
                       jsonb_build_object('group_name', NEW.name), NOW()
                FROM group_members gm
                WHERE gm.group_id = NEW.id AND gm.is_active = true
                ON CONFLICT (user_id, kind, ref_id) DO NOTHING;
                RETURN NEW;
            END IF;

            -- group_note_changed: fan out to every active member; mark editor read.
            IF NEW.is_active = true AND NEW.note IS DISTINCT FROM OLD.note THEN
                INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata, created_at)
                SELECT gm.user_id, 'group_note_changed', NEW.id, gen_random_uuid(), v_actor,
                       jsonb_build_object('group_name', NEW.name), NOW()
                FROM group_members gm
                WHERE gm.group_id = NEW.id AND gm.is_active = true
                ON CONFLICT (user_id, kind, ref_id) DO NOTHING;

                -- The editor just wrote it: never show them their own dot.
                IF v_actor IS NOT NULL THEN
                    UPDATE group_members SET note_seen_at = NOW()
                    WHERE group_id = NEW.id AND user_id = v_actor;
                END IF;
            END IF;
        END IF;

        RETURN NEW;
    END;
    $$;

DROP TRIGGER IF EXISTS trg_group_activity_events ON groups;
CREATE TRIGGER trg_group_activity_events
    AFTER INSERT OR UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION emit_group_activity_events();
```

- [ ] **Step 4: Extend the friend-request trigger for rejection**

Append (this `CREATE OR REPLACE` supersedes `20260526105507`'s function; the trigger definition is unchanged so we only replace the function):

```sql
-- 5. Friend-request activity: add a sender-side row on rejection, and carry
--    responder_user_id so the feed can render perspective ("You declined" vs
--    "{name} declined your request"). Mirrors the existing 'accepted' flow.
CREATE OR REPLACE FUNCTION emit_friend_request_activity_events() RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
        IF TG_OP = 'INSERT' THEN
            INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata, created_at)
            VALUES (
                NEW.to_user_id, 'friend_request_received', NULL, NEW.id, NEW.from_user_id,
                jsonb_build_object('status', NEW.status, 'responded_at', NEW.responded_at),
                NEW.created_at
            )
            ON CONFLICT (user_id, kind, ref_id) DO NOTHING;
        END IF;

        IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
            -- Update recipient's existing row in place (does not bump created_at,
            -- so the push update-webhook stays quiet for the responder).
            UPDATE activity_events
            SET metadata = jsonb_build_object(
                'status', NEW.status,
                'responded_at', NEW.responded_at,
                'responder_user_id', NEW.to_user_id
            )
            WHERE kind = 'friend_request_received' AND ref_id = NEW.id;

            -- Sender-side row on acceptance OR rejection so the sender sees the outcome.
            IF NEW.status IN ('accepted', 'rejected') THEN
                INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata, created_at)
                VALUES (
                    NEW.from_user_id, 'friend_request_received', NULL, NEW.id, NEW.to_user_id,
                    jsonb_build_object(
                        'status', NEW.status,
                        'responded_at', NEW.responded_at,
                        'responder_user_id', NEW.to_user_id
                    ),
                    COALESCE(NEW.responded_at, NOW())
                )
                ON CONFLICT (user_id, kind, ref_id) DO NOTHING;
            END IF;
        END IF;
        RETURN NEW;
    END;
    $$;
```

- [ ] **Step 5: Add the mark_group_note_seen RPC + grants**

Append:

```sql
-- 6. Mark the caller's note as seen (clears the unread dot).
CREATE OR REPLACE FUNCTION mark_group_note_seen(p_group_id uuid) RETURNS void
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public
    AS $$
        UPDATE group_members SET note_seen_at = NOW()
        WHERE group_id = p_group_id AND user_id = auth.uid();
    $$;

REVOKE EXECUTE ON FUNCTION mark_group_note_seen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION mark_group_note_seen(uuid) TO authenticated;
```

- [ ] **Step 6: Write the SQL regression test**

Create `supabase/__tests__/group_friend_activity_events.test.sql`:

```sql
-- Run via Supabase MCP execute_sql against dev (drxfbicunusmipdgbgdk). ROLLBACKs.
BEGIN;
SET LOCAL session_replication_role = replica;

ALTER TABLE groups          ENABLE ALWAYS TRIGGER trg_group_activity_events;
ALTER TABLE groups          ENABLE ALWAYS TRIGGER trg_stamp_group_note_updated_at;
ALTER TABLE friend_requests ENABLE ALWAYS TRIGGER trg_friend_request_activity_events;
ALTER TABLE group_members   ENABLE ALWAYS TRIGGER trg_group_membership_activity_events;

DO $outer$
DECLARE
    v_group  CONSTANT UUID := '00000000-0000-0000-0000-0000000bf001';
    v_alice  CONSTANT UUID := '00000000-0000-0000-0000-0000000bfa01';
    v_bob    CONSTANT UUID := '00000000-0000-0000-0000-0000000bfb01';
    v_fr     UUID;
    v_count  INT;
    v_seen   TIMESTAMPTZ;
    v_upd    TIMESTAMPTZ;
BEGIN
    -- seed users + simulate Alice as the auth'd actor
    INSERT INTO auth.users (id) VALUES (v_alice), (v_bob);
    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token)
    VALUES (v_alice, 'bf-a@test.local', 'Alice', 'USD', 'en', TRUE, 'tt_bf_a'),
           (v_bob,   'bf-b@test.local', 'Bob',   'USD', 'en', TRUE, 'tt_bf_b');
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_alice::text)::text, true);

    -- CASE 1: group_created → exactly one event for the creator
    INSERT INTO public.groups (id, name, default_currency, created_by, is_active, group_type, invite_token)
    VALUES (v_group, 'BF Group', 'USD', v_alice, TRUE, 'general', 'tt_bf_group');
    SELECT COUNT(*) INTO v_count FROM activity_events WHERE kind = 'group_created' AND group_id = v_group;
    IF v_count <> 1 THEN RAISE EXCEPTION 'Case 1: expected 1 group_created, got %', v_count; END IF;
    PERFORM 1 FROM activity_events WHERE kind = 'group_created' AND user_id = v_alice AND actor_user_id = v_alice;
    IF NOT FOUND THEN RAISE EXCEPTION 'Case 1: group_created actor/user mismatch'; END IF;

    -- members: Alice (founder) + Bob
    INSERT INTO public.group_members (group_id, user_id, is_active, joined_at)
    VALUES (v_group, v_alice, TRUE, now()), (v_group, v_bob, TRUE, now());

    -- CASE 2: note change → event for every active member; note_updated_at stamped;
    --         editor (Alice) auto-marked seen, Bob not.
    UPDATE public.groups SET note = 'hello team' WHERE id = v_group;
    SELECT COUNT(*) INTO v_count FROM activity_events WHERE kind = 'group_note_changed' AND group_id = v_group;
    IF v_count <> 2 THEN RAISE EXCEPTION 'Case 2: expected 2 group_note_changed, got %', v_count; END IF;
    SELECT note_updated_at INTO v_upd FROM groups WHERE id = v_group;
    IF v_upd IS NULL THEN RAISE EXCEPTION 'Case 2: note_updated_at not stamped'; END IF;
    SELECT note_seen_at INTO v_seen FROM group_members WHERE group_id = v_group AND user_id = v_alice;
    IF v_seen IS NULL THEN RAISE EXCEPTION 'Case 2: editor note_seen_at not set'; END IF;
    SELECT note_seen_at INTO v_seen FROM group_members WHERE group_id = v_group AND user_id = v_bob;
    IF v_seen IS NOT NULL THEN RAISE EXCEPTION 'Case 2: non-editor should be unseen'; END IF;

    -- CASE 3: friend rejection → recipient row updated + sender row inserted, both carry responder
    INSERT INTO public.friend_requests (id, from_user_id, to_user_id, status, created_at)
    VALUES (gen_random_uuid(), v_bob, v_alice, 'pending', now())
    RETURNING id INTO v_fr;
    UPDATE public.friend_requests SET status = 'rejected', responded_at = now() WHERE id = v_fr;
    -- recipient (Alice) row + sender (Bob) row = 2 rows for this ref
    SELECT COUNT(*) INTO v_count FROM activity_events
        WHERE kind = 'friend_request_received' AND ref_id = v_fr;
    IF v_count <> 2 THEN RAISE EXCEPTION 'Case 3: expected 2 friend rows, got %', v_count; END IF;
    PERFORM 1 FROM activity_events WHERE ref_id = v_fr AND user_id = v_bob
        AND actor_user_id = v_alice AND metadata->>'status' = 'rejected'
        AND metadata->>'responder_user_id' = v_alice::text;
    IF NOT FOUND THEN RAISE EXCEPTION 'Case 3: sender rejection row missing/incorrect'; END IF;

    -- CASE 4: mark_group_note_seen clears Bob's unread (set jwt to Bob)
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_bob::text)::text, true);
    PERFORM mark_group_note_seen(v_group);
    SELECT note_seen_at INTO v_seen FROM group_members WHERE group_id = v_group AND user_id = v_bob;
    IF v_seen IS NULL OR v_seen < v_upd THEN RAISE EXCEPTION 'Case 4: note_seen_at not advanced'; END IF;

    -- CASE 5: group_deleted → event for every active member, actor = deleter (Alice)
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_alice::text)::text, true);
    UPDATE public.groups SET is_active = false WHERE id = v_group;
    SELECT COUNT(*) INTO v_count FROM activity_events WHERE kind = 'group_deleted' AND group_id = v_group;
    IF v_count <> 2 THEN RAISE EXCEPTION 'Case 5: expected 2 group_deleted, got %', v_count; END IF;
    PERFORM 1 FROM activity_events WHERE kind = 'group_deleted' AND user_id = v_bob AND actor_user_id = v_alice;
    IF NOT FOUND THEN RAISE EXCEPTION 'Case 5: group_deleted actor should be deleter'; END IF;

    RAISE NOTICE 'group_friend_activity_events: ALL CASES PASSED';
END $outer$;

ROLLBACK;
```

- [ ] **Step 7: Apply the migration to dev and run the SQL test**

Apply the migration to the dev project, then run the test file's contents via Supabase MCP `execute_sql` against dev (`drxfbicunusmipdgbgdk`).
Expected: the final `RAISE NOTICE 'group_friend_activity_events: ALL CASES PASSED'` with no exception; transaction rolls back.

To load the MCP tool: `ToolSearch` with `select:mcp__supabase__execute_sql` (authenticate first if prompted). Apply migrations the same way the repo applies others (Supabase CLI `db push` to dev, or the MCP apply-migration tool).

- [ ] **Step 8: Commit**

```bash
git add cost-share-app/supabase/migrations/20260625130000_activity_group_friend_events.sql cost-share-app/supabase/__tests__/group_friend_activity_events.test.sql
git commit -m "feat(db): group created/deleted/note-changed triggers, friend-reject both-sides, note-seen RPC"
```

---

## Task 4: Mobile — feed copy, title resolution, navigation

**Files:**
- Modify: `cost-share-app/apps/mobile/i18n/locales/en.json` + `he.json` (`activity.notifications`)
- Modify: `cost-share-app/apps/mobile/components/ActivityItemCard.tsx:33-90` (`resolveActivityTitle`)
- Modify: `cost-share-app/apps/mobile/components/ActivityItem.tsx:97-120` (meta switch)
- Modify: `cost-share-app/apps/mobile/screens/activity/ActivityFeedScreen.tsx:544-595` (`handleActivityPress`)
- Test: `cost-share-app/apps/mobile/__tests__/components/ActivityItemCard.test.tsx`

**Interfaces:**
- Consumes: `ActivityEventKind` from Task 1; `metadata.responder_user_id` from Task 3.
- Produces: `resolveActivityTitle` returns correct strings for the four cases; `handleActivityPress` routes `group_note_changed` to GroupNote.

- [ ] **Step 1: Add feed copy keys (en)**

In `apps/mobile/i18n/locales/en.json`, under `activity.notifications`, add (keep the existing `friendRequestRejected`):

```json
            "groupCreatedByYou": "Group {{group}} created by you",
            "groupDeletedByYou": "Group {{group}} deleted by you",
            "groupDeletedBy": "Group {{group}} deleted by {{name}}",
            "noteChangedByYou": "Note changed by you · {{group}}",
            "noteChangedBy": "Note changed by {{name}} · {{group}}",
            "friendRequestRejectedByThem": "{{name}} declined your friend request"
```

- [ ] **Step 2: Add feed copy keys (he)**

In `apps/mobile/i18n/locales/he.json`, under `activity.notifications`:

```json
            "groupCreatedByYou": "קבוצה {{group}} נוצרה על ידך",
            "groupDeletedByYou": "קבוצה {{group}} נמחקה על ידך",
            "groupDeletedBy": "קבוצה {{group}} נמחקה על ידי {{name}}",
            "noteChangedByYou": "הפתק שונה על ידך · {{group}}",
            "noteChangedBy": "הפתק שונה על ידי {{name}} · {{group}}",
            "friendRequestRejectedByThem": "{{name}} דחה/תה את בקשת החברות שלך"
```

- [ ] **Step 3: Write failing title-resolution tests**

Append to `apps/mobile/__tests__/components/ActivityItemCard.test.tsx` (match the file's existing import of `resolveActivityTitle` and its `t` mock; if it renders the component instead, follow that file's existing pattern — the assertions below are the behavior to encode):

```tsx
describe('resolveActivityTitle — group + friend events', () => {
    const t = ((k: string, o?: Record<string, unknown>) =>
        `${k}${o ? ' ' + JSON.stringify(o) : ''}`) as unknown as TFunction;
    const base = { actorName: '', groupName: 'Trip', currentUserId: 'me' };

    it('group_created → created-by-you', () => {
        const e = { kind: 'group_created', metadata: {}, actorUserId: 'me', userId: 'me' } as any;
        expect(resolveActivityTitle(e, { ...base, actorName: 'Me' }, t))
            .toContain('activity.notifications.groupCreatedByYou');
    });

    it('group_deleted by someone else → deleted-by name', () => {
        const e = { kind: 'group_deleted', metadata: {}, actorUserId: 'u2', userId: 'me' } as any;
        expect(resolveActivityTitle(e, { ...base, actorName: 'Alice' }, t))
            .toContain('activity.notifications.groupDeletedBy');
    });

    it('group_deleted by you → deleted-by-you', () => {
        const e = { kind: 'group_deleted', metadata: {}, actorUserId: 'me', userId: 'me' } as any;
        expect(resolveActivityTitle(e, { ...base, actorName: 'Me' }, t))
            .toContain('activity.notifications.groupDeletedByYou');
    });

    it('group_note_changed by someone else → note-changed-by name', () => {
        const e = { kind: 'group_note_changed', metadata: {}, actorUserId: 'u2', userId: 'me' } as any;
        expect(resolveActivityTitle(e, { ...base, actorName: 'Alice' }, t))
            .toContain('activity.notifications.noteChangedBy');
    });

    it('friend reject — rejecter sees "you declined"', () => {
        const e = { kind: 'friend_request_received', actorUserId: 'u2', userId: 'me',
            metadata: { status: 'rejected', responder_user_id: 'me' } } as any;
        expect(resolveActivityTitle(e, { ...base, actorName: 'Bob' }, t))
            .toContain('activity.notifications.friendRequestRejected ');
    });

    it('friend reject — sender sees "{name} declined your request"', () => {
        const e = { kind: 'friend_request_received', actorUserId: 'u2', userId: 'me',
            metadata: { status: 'rejected', responder_user_id: 'u2' } } as any;
        expect(resolveActivityTitle(e, { ...base, actorName: 'Bob' }, t))
            .toContain('activity.notifications.friendRequestRejectedByThem');
    });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd cost-share-app/apps/mobile && npx jest __tests__/components/ActivityItemCard.test.tsx -t "group + friend events"`
Expected: FAIL — new cases not handled.

- [ ] **Step 5: Update resolveActivityTitle**

In `ActivityItemCard.tsx`, replace the `friend_request_received` case (lines 41-50) with status+perspective handling, and add the three group cases before the closing brace of the `switch`. The function already destructures `currentUserId`; it also has access to `event.userId` and `event.actorUserId`.

```tsx
        case 'friend_request_received': {
            const status = (meta.status as string | undefined) ?? 'pending';
            if (status === 'accepted') {
                return t('activity.notifications.friendRequestAccepted', { name: actorName });
            }
            if (status === 'rejected') {
                const responder = meta.responder_user_id as string | undefined;
                // Rejecter's own row → "You declined {name}'s request".
                // Sender's row (responder is the other person) → "{name} declined your request".
                if (responder && currentUserId && responder === currentUserId) {
                    return t('activity.notifications.friendRequestRejected', { name: actorName });
                }
                return t('activity.notifications.friendRequestRejectedByThem', { name: actorName });
            }
            return t('activity.notifications.friendRequest', { name: actorName });
        }
        case 'group_created':
            return t('activity.notifications.groupCreatedByYou', { group: groupName });
        case 'group_deleted':
            if (event.actorUserId && currentUserId && event.actorUserId === currentUserId) {
                return t('activity.notifications.groupDeletedByYou', { group: groupName });
            }
            return t('activity.notifications.groupDeletedBy', { name: actorName, group: groupName });
        case 'group_note_changed':
            if (event.actorUserId && currentUserId && event.actorUserId === currentUserId) {
                return t('activity.notifications.noteChangedByYou', { group: groupName });
            }
            return t('activity.notifications.noteChangedBy', { name: actorName, group: groupName });
```

Note: the `switch` is over `ActivityEventKind` (now 10 members). If TS flags non-exhaustiveness, these three cases plus the existing ones cover all kinds.

- [ ] **Step 6: Add meta/timestamp handling in ActivityItem.tsx**

In `ActivityItem.tsx`, add the new kinds to the timestamp-only branch of the `metaText` switch (lines 106-118), so they show just the timestamp like other group events:

```tsx
            case 'settlement_added':
            case 'friend_request_received':
            case 'group_added':
            case 'group_member_joined':
            case 'group_removed':
            case 'group_created':
            case 'group_deleted':
            case 'group_note_changed':
                metaText = timestamp;
                break;
```

- [ ] **Step 7: Run title tests to verify they pass**

Run: `cd cost-share-app/apps/mobile && npx jest __tests__/components/ActivityItemCard.test.tsx`
Expected: PASS.

- [ ] **Step 8: Add GroupNote navigation in handleActivityPress**

In `ActivityFeedScreen.tsx`, inside `handleActivityPress`, add a `group_note_changed` case BEFORE the final generic `if (event.groupId)` block (after the `message_posted` block, around line 578). The existing `knownGroupIds` guard above it already shows the unavailable toast when the group is gone; `group_created` and `group_deleted` correctly fall through to that guard / the generic group-nav block.

```tsx
            // group_note_changed → open the shared note screen.
            if (event.kind === 'group_note_changed' && event.groupId) {
                navigation.navigate('Groups', {
                    screen: 'GroupNote',
                    params: { groupId: event.groupId },
                    merge: true,
                });
                return;
            }
```

- [ ] **Step 9: Run the activity feed screen tests**

Run: `cd cost-share-app/apps/mobile && npx jest __tests__/screens/activity`
Expected: PASS (no regression).

- [ ] **Step 10: Commit**

```bash
git add cost-share-app/apps/mobile/i18n cost-share-app/apps/mobile/components/ActivityItemCard.tsx cost-share-app/apps/mobile/components/ActivityItem.tsx cost-share-app/apps/mobile/screens/activity/ActivityFeedScreen.tsx cost-share-app/apps/mobile/__tests__/components/ActivityItemCard.test.tsx
git commit -m "feat(activity): feed copy + navigation for group events and friend rejection"
```

---

## Task 5: Mobile — unread-note dot

**Files:**
- Modify: `cost-share-app/apps/mobile/services/groups.service.ts:170-211` (select + compute), add `markGroupNoteSeen`
- Modify: `cost-share-app/apps/mobile/screens/groups/GroupNoteScreen.tsx:46-60` (mount effect)
- Modify: `cost-share-app/apps/mobile/components/groupDetail/SummaryFooter.tsx` (dot)
- Modify: `cost-share-app/apps/mobile/components/groupDetail/GroupSummaryCard.tsx` (prop passthrough)
- Modify: `cost-share-app/apps/mobile/screens/groups/GroupDetailScreen.tsx:826-838` (pass prop)
- Test: `cost-share-app/apps/mobile/__tests__/components/SummaryFooter.test.tsx`

**Interfaces:**
- Consumes: `GroupWithMembers.hasUnreadNote` (Task 1), `Group.noteUpdatedAt` (Task 1), `mark_group_note_seen` RPC (Task 3).
- Produces: `markGroupNoteSeen(groupId: string): Promise<void>`; `SummaryFooter` prop `noteHasUnread?: boolean`; `GroupSummaryCard` prop `noteHasUnread?: boolean`.

- [ ] **Step 1: Select note_seen_at and compute hasUnreadNote**

In `groups.service.ts` `fetchGroupsInternal`, change the `.select(...)` (line 195-197) to include `note_seen_at` in the member join:

```ts
            .select(
                '*, group_members!inner(user_id, is_active, note_seen_at, profiles!group_members_user_id_fkey(id, name, avatar_url, is_active))',
            )
```

Then replace the mapping (line 204) so the current user's `note_seen_at` drives `hasUnreadNote` (`userId` is already in scope from line 177):

```ts
        const groups = (data ?? []).map((row) => {
            const g = groupWithMembersFromRow(row);
            const myRow = (row.group_members ?? []).find(
                (m: { user_id?: unknown; note_seen_at?: unknown }) => String(m.user_id) === userId,
            );
            const seenAt = myRow?.note_seen_at ? new Date(myRow.note_seen_at as string) : null;
            const updatedAt = g.noteUpdatedAt ?? null;
            const hasUnreadNote = !!updatedAt && (!seenAt || seenAt < updatedAt);
            return { ...g, hasUnreadNote };
        });
```

- [ ] **Step 2: Add markGroupNoteSeen service function**

In `groups.service.ts`, add near the other exported mutators (after `deleteGroup`):

```ts
/**
 * Mark the caller's group note as read — clears the unread-note dot. Called when
 * the GroupNote screen opens (whether reached intentionally or via a push tap).
 */
export async function markGroupNoteSeen(groupId: string): Promise<void> {
    const { error } = await supabase.rpc('mark_group_note_seen', { p_group_id: groupId });
    if (error) {
        console.error('markGroupNoteSeen failed:', error);
        return;
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.groups });
}
```

- [ ] **Step 3: Call markGroupNoteSeen on GroupNote mount**

In `GroupNoteScreen.tsx`, import the service and add a mount effect. Add to the existing import from the groups service (it already imports `getGroupById`):

```tsx
import { getGroupById, markGroupNoteSeen } from '../../services/groups.service';
```

Add an effect after the existing load `useEffect` (around line 60):

```tsx
    useEffect(() => {
        void markGroupNoteSeen(groupId);
    }, [groupId]);
```

- [ ] **Step 4: Write a failing SummaryFooter dot test**

In `apps/mobile/__tests__/components/SummaryFooter.test.tsx`, add (follow the file's existing render/import style):

```tsx
it('shows the unread-note dot when noteHasUnread is true', () => {
    const { getByTestId } = render(
        <SummaryFooter settlementCount={0} onOpenNote={jest.fn()} onOpenSettleUp={jest.fn()} noteHasUnread />,
    );
    expect(getByTestId('summary-note-unread-dot')).toBeTruthy();
});

it('hides the unread-note dot by default', () => {
    const { queryByTestId } = render(
        <SummaryFooter settlementCount={0} onOpenNote={jest.fn()} onOpenSettleUp={jest.fn()} />,
    );
    expect(queryByTestId('summary-note-unread-dot')).toBeNull();
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `cd cost-share-app/apps/mobile && npx jest __tests__/components/SummaryFooter.test.tsx`
Expected: FAIL — prop and dot not present.

- [ ] **Step 6: Add the dot to SummaryFooter**

In `SummaryFooter.tsx`: add `noteHasUnread?: boolean` to `SummaryFooterProps`, destructure it, render an absolutely-positioned dot inside the note `TouchableOpacity`, and add `position: 'relative'` to `notePill` plus a `noteUnreadDot` style. Import already includes `colors`.

Props + destructure:

```tsx
interface SummaryFooterProps {
    settlementCount: number;
    onOpenNote: () => void;
    onOpenSettleUp: () => void;
    noteHasUnread?: boolean;
}

export function SummaryFooter({
    settlementCount,
    onOpenNote,
    onOpenSettleUp,
    noteHasUnread,
}: SummaryFooterProps) {
```

Inside the note `TouchableOpacity` (after the closing `</Text>` for the note label, before `</TouchableOpacity>` at line 61):

```tsx
                    {noteHasUnread ? (
                        <View style={styles.noteUnreadDot} testID="summary-note-unread-dot" />
                    ) : null}
```

Add to `styles.notePill` the line `position: 'relative',` and add a new style:

```tsx
    noteUnreadDot: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 9,
        height: 9,
        borderRadius: 9999,
        backgroundColor: colors.warning,
        borderWidth: 1.5,
        borderColor: '#fff',
    },
```

- [ ] **Step 7: Thread the prop through GroupSummaryCard**

In `GroupSummaryCard.tsx`: add `noteHasUnread?: boolean` to its props interface, destructure it, and pass it to `<SummaryFooter ... noteHasUnread={noteHasUnread} />`.

```tsx
    onOpenSettleUp: () => void;
    noteHasUnread?: boolean;
}
```

```tsx
            <SummaryFooter
                settlementCount={settlementCount}
                onOpenNote={onOpenNote}
                onOpenSettleUp={onOpenSettleUp}
                noteHasUnread={noteHasUnread}
            />
```

(Add `noteHasUnread,` to the destructured params list alongside `onOpenSettleUp`.)

- [ ] **Step 8: Pass hasUnreadNote from GroupDetailScreen**

In `GroupDetailScreen.tsx`, add the prop to the `<GroupSummaryCard ... />` usage (after `onOpenSettleUp={handleSettleUp}` at line 837):

```tsx
                            noteHasUnread={displayGroup.hasUnreadNote}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `cd cost-share-app/apps/mobile && npx jest __tests__/components/SummaryFooter.test.tsx __tests__/components/GroupSummaryCard.test.tsx`
Expected: PASS.

- [ ] **Step 10: Typecheck the mobile app**

Run: `cd cost-share-app/apps/mobile && npx tsc --noEmit`
Expected: PASS — `displayGroup.hasUnreadNote` resolves (GroupWithMembers), no missing-prop errors.

- [ ] **Step 11: Commit**

```bash
git add cost-share-app/apps/mobile/services/groups.service.ts cost-share-app/apps/mobile/screens/groups/GroupNoteScreen.tsx cost-share-app/apps/mobile/components/groupDetail/SummaryFooter.tsx cost-share-app/apps/mobile/components/groupDetail/GroupSummaryCard.tsx cost-share-app/apps/mobile/screens/groups/GroupDetailScreen.tsx cost-share-app/apps/mobile/__tests__/components/SummaryFooter.test.tsx
git commit -m "feat(groups): unread-note dot with mark-seen on note open"
```

---

## Final verification

- [ ] **Edge tests:** `cd cost-share-app/supabase/functions/send-push && deno test`
- [ ] **Shared build:** `cd cost-share-app && npm run build -w @cost-share/shared`
- [ ] **Mobile tests + typecheck:** `cd cost-share-app/apps/mobile && npx jest && npx tsc --noEmit`
- [ ] **SQL regression:** run `supabase/__tests__/group_friend_activity_events.test.sql` via Supabase MCP `execute_sql` against dev → "ALL CASES PASSED".
- [ ] **Manual smoke (dev build):** create a group (feed shows "created by you", no push); have another member change the note (push arrives, dot appears on note pill, clears after opening); delete a group (other member gets push + feed row); reject a friend request (sender gets push + feed row "X declined your friend request", rejecter sees "You declined X's request", no push to rejecter).
