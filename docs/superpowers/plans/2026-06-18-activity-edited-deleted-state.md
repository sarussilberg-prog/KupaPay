# Activity Feed — Edited & Deleted State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface edits and soft-deletes of expenses, settlements, and group messages on the Activity Feed — with inline "Edited"/"Deleted" badges, a deletion-notice popup for expense/settlement rows, per-user "Remove from activity" hide, and distinct push notification copy.

**Architecture:** A small backend change augments the three existing `emit_*_activity_events` triggers so that content edits write `is_edited: true` into `activity_events.metadata`, and soft-deletes switch from DELETE→UPDATE (writing `is_deleted/deleted_at/deleted_by` while preserving last-known content via jsonb merge). A new per-user-DELETE RLS policy enables the "Remove from activity" action. The frontend reads the new metadata flags to render badges, route deleted rows to a deletion-notice variant of `FeedItemDetailSheet`, and call a new `removeActivityEvent` service. The existing push pipeline already fires on UPDATE-when-`created_at`-bumps; we only add edit/delete copy variants to `send-push`'s `render.ts` and thread `is_edited`/`is_deleted` through `handler.ts`.

**Tech Stack:** Supabase (PostgreSQL + pg triggers + RLS), Deno edge functions, React Native (Expo), TypeScript, React Query, i18next (en/he), Jest (mobile), Deno test (edge functions).

**Spec:** `docs/superpowers/specs/2026-06-18-activity-edited-badge-design.md`

---

## File Structure

**New files**
- `cost-share-app/supabase/migrations/<YYYYMMDDhhmmss>_activity_events_edited_deleted_flags.sql` — trigger fn changes + RLS policy.
- `cost-share-app/apps/mobile/services/activityEvents.service.ts` — per-user delete helper.

**Modified files**
- `cost-share-app/apps/mobile/components/ActivityItem.tsx` — append " · Edited"/" · Deleted" suffix.
- `cost-share-app/apps/mobile/components/DetailSheetHeader.tsx` — make Edit/Delete optional, add Remove-from-activity menu item.
- `cost-share-app/apps/mobile/components/FeedItemDetailSheet.tsx` — `deletedNotice` prop renders deletion-notice body, hides Edit/Delete actions.
- `cost-share-app/apps/mobile/screens/activity/ActivityFeedScreen.tsx` — recognise deleted rows, skip live refetch, pass `deletedNotice` + `onRemoveFromActivity`, resolve deleter profile.
- `cost-share-app/apps/mobile/i18n/locales/en.json`, `he.json` — new keys.
- `cost-share-app/supabase/functions/send-push/render.ts` — edit/delete copy variants.
- `cost-share-app/supabase/functions/send-push/handler.ts` — thread `is_edited` / `is_deleted` through.

**New / extended tests**
- `cost-share-app/apps/mobile/__tests__/components/ActivityItem.test.tsx` — badge cases.
- `cost-share-app/apps/mobile/__tests__/components/FeedItemDetailSheet.test.tsx` — deletion-notice and kebab.
- `cost-share-app/apps/mobile/__tests__/services/activityEvents.service.test.ts` — service unit test.
- `cost-share-app/supabase/functions/send-push/render.test.ts` — six new push variants.
- `cost-share-app/supabase/functions/send-push/handler.test.ts` — verifies flags are forwarded.

**Self-contained:** every task ends with a green-tests-and-commit step. Tasks are ordered so the migration ships first (no UI references missing data), then mobile-only tasks, then edge-function tasks (so the push copy is correct from the moment the migration is live).

---

## Task 1: Backend migration — edit metadata flags + delete-as-update + RLS

**Files:**
- Create: `cost-share-app/supabase/migrations/<YYYYMMDDhhmmss>_activity_events_edited_deleted_flags.sql`
  - Use a fresh UTC timestamp greater than the latest migration (`20260618110000_activity_events_fire_on_edit.sql`). For example: `20260618192600_activity_events_edited_deleted_flags.sql`.

- [ ] **Step 1: Create the migration file with the full SQL below**

```sql
-- 2026-06-18 — Surface "edited" and "deleted" lifecycle states on activity rows.
--
-- Changes vs. 20260618110000_activity_events_fire_on_edit.sql:
--   1. Edit branch now also writes is_edited=true, edited_at=NOW() into metadata
--      (replaces the existing wholesale jsonb_build_object payload).
--   2. Soft-delete branch switches from DELETE → UPDATE: rows stay in the feed
--      with is_deleted=true, deleted_at=NOW(), deleted_by=auth.uid(), and
--      created_at bumped so the row resurfaces at the top. Uses jsonb || merge
--      so the last-known content (description/amount/...) is preserved for the
--      client's deletion-notice popup.
--   3. New RLS policy lets a user DELETE their own activity_events row, which
--      powers the "Remove from activity" per-user hide.

BEGIN;

-- ============================================================================
-- 1. emit_expense_activity_events
-- ============================================================================

CREATE OR REPLACE FUNCTION emit_expense_activity_events() RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
        -- INSERT or un-delete: fan-out new rows to all active members.
        -- Note: with the soft-delete branch now leaving rows in place,
        -- un-delete hits ON CONFLICT DO NOTHING and the row stays as-was
        -- (is_deleted still true). v1 doesn't expose un-delete in the UI.
        IF (TG_OP = 'INSERT' AND NEW.is_deleted = false)
           OR (TG_OP = 'UPDATE' AND OLD.is_deleted = true AND NEW.is_deleted = false) THEN
            INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata, created_at)
            SELECT
                gm.user_id,
                'expense_added',
                NEW.group_id,
                NEW.id,
                NEW.created_by,
                jsonb_build_object(
                    'description', NEW.description,
                    'amount',      NEW.amount,
                    'currency',    NEW.currency,
                    'expense_date', NEW.expense_date
                ),
                NEW.created_at
            FROM group_members gm
            WHERE gm.group_id = NEW.group_id AND gm.is_active = true
            ON CONFLICT (user_id, kind, ref_id) DO NOTHING;

        -- Content edit: refresh metadata + bump created_at, and mark is_edited.
        ELSIF TG_OP = 'UPDATE' AND NEW.is_deleted = false
              AND (OLD.description  IS DISTINCT FROM NEW.description
                   OR OLD.amount    IS DISTINCT FROM NEW.amount
                   OR OLD.currency  IS DISTINCT FROM NEW.currency
                   OR OLD.expense_date IS DISTINCT FROM NEW.expense_date) THEN
            UPDATE activity_events
            SET metadata = jsonb_build_object(
                    'description', NEW.description,
                    'amount',      NEW.amount,
                    'currency',    NEW.currency,
                    'expense_date', NEW.expense_date,
                    'is_edited',   true,
                    'edited_at',   NOW()
                ),
                created_at = NOW()
            WHERE kind = 'expense_added' AND ref_id = NEW.id;
        END IF;

        -- Soft-delete: mark rows deleted in-place (was: DELETE).
        IF TG_OP = 'UPDATE' AND OLD.is_deleted = false AND NEW.is_deleted = true THEN
            UPDATE activity_events
            SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                    'is_deleted', true,
                    'deleted_at', NOW(),
                    'deleted_by', auth.uid()
                ),
                created_at = NOW()
            WHERE kind = 'expense_added' AND ref_id = NEW.id;
        END IF;

        RETURN NEW;
    END;
    $$;

-- Trigger unchanged from 20260618110000 — column-watch already covers the
-- relevant columns; we recreate it idempotently for safety.
DROP TRIGGER IF EXISTS trg_expense_activity_events ON expenses;
CREATE TRIGGER trg_expense_activity_events
    AFTER INSERT OR UPDATE OF is_deleted, description, amount, currency, expense_date ON expenses
    FOR EACH ROW EXECUTE FUNCTION emit_expense_activity_events();

-- ============================================================================
-- 2. emit_settlement_activity_events
-- ============================================================================

CREATE OR REPLACE FUNCTION emit_settlement_activity_events() RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
        -- INSERT or un-delete.
        IF (TG_OP = 'INSERT' AND NEW.deleted_at IS NULL)
           OR (TG_OP = 'UPDATE' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL) THEN
            INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata, created_at)
            SELECT
                gm.user_id,
                'settlement_added',
                NEW.group_id,
                NEW.id,
                NEW.created_by,
                jsonb_build_object(
                    'from_user_id',     NEW.from_user_id,
                    'to_user_id',       NEW.to_user_id,
                    'amount',           NEW.amount,
                    'currency',         NEW.currency,
                    'settlement_date',  NEW.settlement_date
                ),
                NEW.created_at
            FROM group_members gm
            WHERE gm.group_id = NEW.group_id AND gm.is_active = true
            ON CONFLICT (user_id, kind, ref_id) DO NOTHING;

        -- Content edit.
        ELSIF TG_OP = 'UPDATE' AND NEW.deleted_at IS NULL
              AND (OLD.from_user_id IS DISTINCT FROM NEW.from_user_id
                   OR OLD.to_user_id   IS DISTINCT FROM NEW.to_user_id
                   OR OLD.amount       IS DISTINCT FROM NEW.amount
                   OR OLD.currency     IS DISTINCT FROM NEW.currency) THEN
            UPDATE activity_events
            SET metadata = jsonb_build_object(
                    'from_user_id',     NEW.from_user_id,
                    'to_user_id',       NEW.to_user_id,
                    'amount',           NEW.amount,
                    'currency',         NEW.currency,
                    'settlement_date',  NEW.settlement_date,
                    'is_edited',        true,
                    'edited_at',        NOW()
                ),
                created_at = NOW()
            WHERE kind = 'settlement_added' AND ref_id = NEW.id;
        END IF;

        -- Soft-delete: mark in-place (was: DELETE).
        IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
            UPDATE activity_events
            SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                    'is_deleted', true,
                    'deleted_at', NOW(),
                    'deleted_by', auth.uid()
                ),
                created_at = NOW()
            WHERE kind = 'settlement_added' AND ref_id = NEW.id;
        END IF;

        RETURN NEW;
    END;
    $$;

DROP TRIGGER IF EXISTS trg_settlement_activity_events ON settlements;
CREATE TRIGGER trg_settlement_activity_events
    AFTER INSERT OR UPDATE OF deleted_at, from_user_id, to_user_id, amount, currency ON settlements
    FOR EACH ROW EXECUTE FUNCTION emit_settlement_activity_events();

-- ============================================================================
-- 3. emit_message_activity_events
-- ============================================================================

CREATE OR REPLACE FUNCTION emit_message_activity_events() RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
        -- INSERT or un-delete.
        IF (TG_OP = 'INSERT' AND NEW.is_deleted = false)
           OR (TG_OP = 'UPDATE' AND OLD.is_deleted = true AND NEW.is_deleted = false) THEN
            INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata, created_at)
            SELECT
                gm.user_id,
                'message_posted',
                NEW.group_id,
                NEW.id,
                NEW.user_id,
                jsonb_build_object('body', LEFT(NEW.body, 200)),
                NEW.created_at
            FROM group_members gm
            WHERE gm.group_id = NEW.group_id AND gm.is_active = true
            ON CONFLICT (user_id, kind, ref_id) DO NOTHING;

        -- Content edit.
        ELSIF TG_OP = 'UPDATE' AND NEW.is_deleted = false
              AND OLD.body IS DISTINCT FROM NEW.body THEN
            UPDATE activity_events
            SET metadata   = jsonb_build_object(
                    'body',      LEFT(NEW.body, 200),
                    'is_edited', true,
                    'edited_at', NOW()
                ),
                created_at = NOW()
            WHERE kind = 'message_posted' AND ref_id = NEW.id;
        END IF;

        -- Soft-delete: mark in-place (was: DELETE).
        IF TG_OP = 'UPDATE' AND OLD.is_deleted = false AND NEW.is_deleted = true THEN
            UPDATE activity_events
            SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                    'is_deleted', true,
                    'deleted_at', NOW(),
                    'deleted_by', auth.uid()
                ),
                created_at = NOW()
            WHERE kind = 'message_posted' AND ref_id = NEW.id;
        END IF;

        RETURN NEW;
    END;
    $$;

DROP TRIGGER IF EXISTS trg_message_activity_events ON group_messages;
CREATE TRIGGER trg_message_activity_events
    AFTER INSERT OR UPDATE OF is_deleted, body ON group_messages
    FOR EACH ROW EXECUTE FUNCTION emit_message_activity_events();

-- ============================================================================
-- 4. RLS — let users DELETE their own activity_events row
-- ============================================================================

DROP POLICY IF EXISTS activity_events_delete_own ON public.activity_events;
CREATE POLICY activity_events_delete_own
    ON public.activity_events
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

COMMIT;
```

- [ ] **Step 2: Apply locally and verify with sqlite-style smoke test (manual)**

If running a local supabase stack:
```bash
cd cost-share-app
supabase db reset    # destructive on local DB only
```
If no local stack, defer verification to step 4 below.

- [ ] **Step 3: Smoke-test the three branches against the local DB (if available)**

Inside `supabase` SQL editor or `psql`, run:
```sql
-- 1. INSERT path (sanity)
INSERT INTO expenses (group_id, created_by, paid_by, amount, currency, description, expense_date)
VALUES ((SELECT id FROM groups LIMIT 1), auth.uid(), auth.uid(), 50, 'ILS', 'Test', NOW())
RETURNING id \gset

SELECT metadata->>'is_edited', metadata->>'is_deleted' FROM activity_events WHERE ref_id = :'id' LIMIT 1;
-- Expect: both NULL (INSERT path doesn't write the flags)

-- 2. Edit path
UPDATE expenses SET description = 'Test 2' WHERE id = :'id';
SELECT metadata->>'is_edited', metadata->>'description' FROM activity_events WHERE ref_id = :'id' LIMIT 1;
-- Expect: 'true', 'Test 2'

-- 3. Delete path
UPDATE expenses SET is_deleted = true WHERE id = :'id';
SELECT metadata->>'is_deleted', metadata->>'deleted_by', metadata->>'description'
  FROM activity_events WHERE ref_id = :'id' LIMIT 1;
-- Expect: 'true', '<your uid>', 'Test 2'  (description preserved via jsonb merge)
```

- [ ] **Step 4: Commit the migration**

```bash
git add cost-share-app/supabase/migrations/<YYYYMMDDhhmmss>_activity_events_edited_deleted_flags.sql
git commit -m "feat(db): activity events surface edited/deleted state"
```

---

## Task 2: Mobile service — removeActivityEvent

**Files:**
- Create: `cost-share-app/apps/mobile/services/activityEvents.service.ts`
- Create: `cost-share-app/apps/mobile/__tests__/services/activityEvents.service.test.ts`

- [ ] **Step 1: Write the failing service test**

`cost-share-app/apps/mobile/__tests__/services/activityEvents.service.test.ts`:
```ts
import { removeActivityEvent } from '../../services/activityEvents.service';
import { supabase } from '../../lib/supabase';

jest.mock('../../lib/supabase', () => {
    const eq = jest.fn();
    const del = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ delete: del }));
    return {
        supabase: { from },
        __mocks: { from, del, eq },
    };
});

const mocks = (jest.requireMock('../../lib/supabase') as { __mocks: { from: jest.Mock; del: jest.Mock; eq: jest.Mock } }).__mocks;

describe('removeActivityEvent', () => {
    beforeEach(() => {
        mocks.from.mockClear();
        mocks.del.mockClear();
        mocks.eq.mockClear();
    });

    it('issues a delete on activity_events filtered by id', async () => {
        mocks.eq.mockResolvedValueOnce({ error: null });
        const ok = await removeActivityEvent('evt-1');
        expect(mocks.from).toHaveBeenCalledWith('activity_events');
        expect(mocks.del).toHaveBeenCalled();
        expect(mocks.eq).toHaveBeenCalledWith('id', 'evt-1');
        expect(ok).toBe(true);
    });

    it('returns false when supabase returns an error', async () => {
        mocks.eq.mockResolvedValueOnce({ error: { message: 'rls', code: '42501' } });
        const ok = await removeActivityEvent('evt-2');
        expect(ok).toBe(false);
    });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

```bash
cd cost-share-app/apps/mobile
npx jest __tests__/services/activityEvents.service.test.ts
```
Expected: FAIL — cannot find module `../../services/activityEvents.service`.

- [ ] **Step 3: Implement the service**

`cost-share-app/apps/mobile/services/activityEvents.service.ts`:
```ts
import { supabase } from '../lib/supabase';

export async function removeActivityEvent(eventId: string): Promise<boolean> {
    const { error } = await supabase
        .from('activity_events')
        .delete()
        .eq('id', eventId);
    if (error) {
        console.error('removeActivityEvent failed:', error);
        return false;
    }
    return true;
}
```

- [ ] **Step 4: Run the test, confirm it passes**

```bash
npx jest __tests__/services/activityEvents.service.test.ts
```
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add cost-share-app/apps/mobile/services/activityEvents.service.ts \
        cost-share-app/apps/mobile/__tests__/services/activityEvents.service.test.ts
git commit -m "feat(mobile): removeActivityEvent service for per-user activity hide"
```

---

## Task 3: i18n keys (en + he)

**Files:**
- Modify: `cost-share-app/apps/mobile/i18n/locales/en.json`
- Modify: `cost-share-app/apps/mobile/i18n/locales/he.json`

- [ ] **Step 1: Insert new keys inside the `"activity"` block in en.json**

Find the `"activity"` block (begins at `cost-share-app/apps/mobile/i18n/locales/en.json:712`). After the `"message": "Message",` line (currently around `:748`), insert:

```json
        "edited": "Edited",
        "deleted": "Deleted",
        "deletionNotice": {
            "expense": "This expense was deleted by {{name}} on {{when}}.",
            "settlement": "This payment was deleted by {{name}} on {{when}}."
        },
        "removeFromActivity": "Remove from activity",
        "removeFromActivityConfirm": "Remove this from your activity?",
```

- [ ] **Step 2: Insert the parallel keys inside the `"activity"` block in he.json**

Find the `"activity"` block in `cost-share-app/apps/mobile/i18n/locales/he.json:728`. Insert in the same relative position:

```json
        "edited": "נערך",
        "deleted": "נמחק",
        "deletionNotice": {
            "expense": "ההוצאה הזו נמחקה על ידי {{name}} ב־{{when}}.",
            "settlement": "התשלום הזה נמחק על ידי {{name}} ב־{{when}}."
        },
        "removeFromActivity": "הסר מהפעילות",
        "removeFromActivityConfirm": "להסיר את זה מהפעילות שלך?",
```

- [ ] **Step 3: Run the i18n parity test**

```bash
cd cost-share-app/apps/mobile
npx jest __tests__/i18n
```
Expected: PASS. (The parity guard walks both files; if it complains about missing keys, the indentation/structure of one of the two files diverged — re-check.)

- [ ] **Step 4: Commit**

```bash
git add cost-share-app/apps/mobile/i18n/locales/en.json cost-share-app/apps/mobile/i18n/locales/he.json
git commit -m "i18n: activity edited/deleted/remove-from-activity strings"
```

---

## Task 4: ActivityItem — Edited / Deleted meta suffix

**Files:**
- Modify: `cost-share-app/apps/mobile/components/ActivityItem.tsx`
- Modify: `cost-share-app/apps/mobile/__tests__/components/ActivityItem.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to the bottom of `ActivityItem.test.tsx`, inside the existing `describe('ActivityItem', …)` block:

```tsx
    it('appends " · Edited" to meta when metadata.is_edited is true (expense)', () => {
        const event = buildEvent('expense_added', {
            metadata: { description: 'Lunch', amount: 12, currency: 'USD', is_edited: true },
        });
        const { getByText } = render(
            <ActivityItem event={event} actor={actor} currentUserId="u-me" />,
        );
        expect(getByText(/Edited/)).toBeTruthy();
    });

    it('appends " · Deleted" to meta when metadata.is_deleted is true (expense)', () => {
        const event = buildEvent('expense_added', {
            metadata: { description: 'Lunch', amount: 12, currency: 'USD', is_deleted: true },
        });
        const { getByText } = render(
            <ActivityItem event={event} actor={actor} currentUserId="u-me" />,
        );
        expect(getByText(/Deleted/)).toBeTruthy();
    });

    it('renders Deleted (not Edited) when both flags are true', () => {
        const event = buildEvent('expense_added', {
            metadata: { description: 'Lunch', amount: 12, currency: 'USD', is_edited: true, is_deleted: true },
        });
        const { queryByText, getByText } = render(
            <ActivityItem event={event} actor={actor} currentUserId="u-me" />,
        );
        expect(getByText(/Deleted/)).toBeTruthy();
        expect(queryByText(/Edited/)).toBeNull();
    });

    it('does not append a suffix when flags are absent', () => {
        const event = buildEvent('expense_added', {
            metadata: { description: 'Lunch', amount: 12, currency: 'USD' },
        });
        const { queryByText } = render(
            <ActivityItem event={event} actor={actor} currentUserId="u-me" />,
        );
        expect(queryByText(/Edited/)).toBeNull();
        expect(queryByText(/Deleted/)).toBeNull();
    });

    it('appends " · Deleted" for settlement_added rows too', () => {
        const event = buildEvent('settlement_added', {
            metadata: { from_user_id: 'u1', to_user_id: 'u-me', amount: 10, currency: 'USD', is_deleted: true },
        });
        const { getByText } = render(
            <ActivityItem event={event} actor={actor} currentUserId="u-me" />,
        );
        expect(getByText(/Deleted/)).toBeTruthy();
    });

    it('appends " · Edited" for message_posted rows', () => {
        const event = buildEvent('message_posted', {
            metadata: { body: 'hi', is_edited: true },
        });
        const { getByText } = render(
            <ActivityItem event={event} actor={actor} currentUserId="u-me" />,
        );
        expect(getByText(/Edited/)).toBeTruthy();
    });

    it('ignores is_edited on non-editable kinds (defensive)', () => {
        const event = buildEvent('group_added', { metadata: { is_edited: true } });
        const { queryByText } = render(
            <ActivityItem event={event} actor={actor} currentUserId="u-me" />,
        );
        expect(queryByText(/Edited/)).toBeNull();
    });
```

- [ ] **Step 2: Run, confirm the new tests fail**

```bash
cd cost-share-app/apps/mobile
npx jest __tests__/components/ActivityItem.test.tsx
```
Expected: the seven new tests fail (no "Edited"/"Deleted" rendered).

- [ ] **Step 3: Modify ActivityItem.tsx — read the flags and append the suffix**

In `cost-share-app/apps/mobile/components/ActivityItem.tsx`, replace the existing `const meta = useMemo(…)` block (lines 88–101) with:

```tsx
    const meta = useMemo(() => {
        const md = (event.metadata ?? {}) as Record<string, unknown>;
        const isEditableKind =
            event.kind === 'expense_added'
            || event.kind === 'settlement_added'
            || event.kind === 'message_posted';
        const suffix =
            isEditableKind && md.is_deleted === true
                ? ` · ${t('activity.deleted')}`
                : isEditableKind && md.is_edited === true
                ? ` · ${t('activity.edited')}`
                : '';
        switch (event.kind) {
            case 'settlement_added':
            case 'friend_request_received':
            case 'group_added':
            case 'group_member_joined':
            case 'group_removed':
                return `${timestamp}${suffix}`;
            case 'expense_added':
            case 'message_posted':
            default:
                return `${actorName} · ${timestamp}${suffix}`;
        }
    }, [event.kind, event.metadata, actorName, timestamp, t]);
```

- [ ] **Step 4: Run tests, confirm all pass**

```bash
npx jest __tests__/components/ActivityItem.test.tsx
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cost-share-app/apps/mobile/components/ActivityItem.tsx \
        cost-share-app/apps/mobile/__tests__/components/ActivityItem.test.tsx
git commit -m "feat(mobile): edited/deleted suffix on activity rows"
```

---

## Task 5: DetailSheetHeader — make actions configurable

**Files:**
- Modify: `cost-share-app/apps/mobile/components/DetailSheetHeader.tsx`

The header today hard-requires `onEdit` and `onDelete`. We need it to:
- Render Edit/Delete only when their callbacks are provided.
- Render a new "Remove from activity" item when `onRemoveFromActivity` is provided.
- Hide the kebab entirely when no menu actions are provided.

No new behaviour test is added here — coverage comes via Task 6's FeedItemDetailSheet tests. We do change the type, so all existing call-sites compile-check at the end of the task.

- [ ] **Step 1: Update the props and the menu rendering**

Replace the contents of `cost-share-app/apps/mobile/components/DetailSheetHeader.tsx` with:

```tsx
/**
 * DetailSheetHeader — shared top bar for FeedItemDetailSheet (expense + settlement).
 * Layout: close ✕ · centered uppercase label · ⋮ kebab popover.
 * Menu items are rendered for each provided callback. The kebab is hidden when
 * no callbacks are passed (e.g., a read-only deletion-notice with nothing to do).
 */

import React, { useState } from 'react';
import {
    View,
    Pressable,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from './AppText';
import { AppIcon } from './AppIcon';
import { colors } from '../theme';

export interface DetailSheetHeaderProps {
    /** Label shown centered; rendered uppercase by the component. */
    label: string;
    onClose: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    onRemoveFromActivity?: () => void;
}

export function DetailSheetHeader({
    label,
    onClose,
    onEdit,
    onDelete,
    onRemoveFromActivity,
}: DetailSheetHeaderProps) {
    const { t } = useTranslation();
    const [menuOpen, setMenuOpen] = useState(false);

    const handleEdit = () => { setMenuOpen(false); onEdit?.(); };
    const handleDelete = () => { setMenuOpen(false); onDelete?.(); };
    const handleRemoveFromActivity = () => {
        setMenuOpen(false);
        onRemoveFromActivity?.();
    };

    const hasMenu = Boolean(onEdit || onDelete || onRemoveFromActivity);

    return (
        <View
            className="flex-row items-center justify-between px-2 pb-1"
            style={{ position: 'relative', zIndex: 5 }}
        >
            <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={t('groups.filters.close')}
                className="w-11 h-11 items-center justify-center"
            >
                <AppIcon name="close" size={22} color={colors.gray600} />
            </TouchableOpacity>

            <Text
                className="text-xs font-semibold uppercase text-gray-500"
                style={{ letterSpacing: 0.7 }}
            >
                {label}
            </Text>

            {hasMenu ? (
                <View>
                    <TouchableOpacity
                        onPress={() => setMenuOpen((o) => !o)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel={t('common.edit')}
                        className="w-11 h-11 items-center justify-center"
                        testID="detail-kebab-btn"
                    >
                        <AppIcon
                            name="ellipsis-vertical"
                            size={20}
                            color={colors.gray600}
                        />
                    </TouchableOpacity>

                    {menuOpen && (
                        <>
                            <Pressable
                                onPress={() => setMenuOpen(false)}
                                style={styles.menuBackdrop}
                            />
                            <View style={styles.menuCard}>
                                {onEdit && (
                                    <TouchableOpacity
                                        onPress={handleEdit}
                                        accessibilityRole="button"
                                        accessibilityLabel={t('common.edit')}
                                        className="flex-row items-center px-3 py-2.5 rounded-lg"
                                        testID="detail-edit-btn"
                                    >
                                        <AppIcon
                                            name="create-outline"
                                            size={16}
                                            color={colors.gray700}
                                        />
                                        <Text className="text-sm font-medium text-gray-900 ml-2.5">
                                            {t('common.edit')}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                {onDelete && (
                                    <TouchableOpacity
                                        onPress={handleDelete}
                                        accessibilityRole="button"
                                        accessibilityLabel={t('common.delete')}
                                        className="flex-row items-center px-3 py-2.5 rounded-lg"
                                        testID="detail-delete-btn"
                                    >
                                        <AppIcon
                                            name="trash-outline"
                                            size={16}
                                            color={colors.error}
                                        />
                                        <Text
                                            className="text-sm font-medium ml-2.5"
                                            style={{ color: colors.error }}
                                        >
                                            {t('common.delete')}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                {onRemoveFromActivity && (
                                    <TouchableOpacity
                                        onPress={handleRemoveFromActivity}
                                        accessibilityRole="button"
                                        accessibilityLabel={t('activity.removeFromActivity')}
                                        className="flex-row items-center px-3 py-2.5 rounded-lg"
                                        testID="detail-remove-from-activity-btn"
                                    >
                                        <AppIcon
                                            name="trash-outline"
                                            size={16}
                                            color={colors.error}
                                        />
                                        <Text
                                            className="text-sm font-medium ml-2.5"
                                            style={{ color: colors.error }}
                                        >
                                            {t('activity.removeFromActivity')}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </>
                    )}
                </View>
            ) : (
                // Spacer so the centered label stays centered.
                <View className="w-11 h-11" />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    menuCard: {
        position: 'absolute',
        top: 42,
        right: 4,
        minWidth: 160,
        padding: 4,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#0F172A',
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 20,
        elevation: 8,
        zIndex: 10,
    },
    menuBackdrop: {
        position: 'absolute',
        top: -1000,
        left: -1000,
        right: -1000,
        bottom: -1000,
        zIndex: 9,
    },
});
```

- [ ] **Step 2: Typecheck — call-sites tolerate optional props**

```bash
cd cost-share-app
npx tsc --noEmit -p apps/mobile/tsconfig.json
```
Expected: PASS. (Existing `FeedItemDetailSheet.tsx` and `GroupDetailScreen.tsx` always pass both `onEdit` and `onDelete`; making them optional is backward compatible.)

- [ ] **Step 3: Run the existing component test, confirm green**

```bash
cd apps/mobile
npx jest __tests__/components/FeedItemDetailSheet.test.tsx
```
Expected: PASS (no behavioural change for current call-sites).

- [ ] **Step 4: Commit**

```bash
git add cost-share-app/apps/mobile/components/DetailSheetHeader.tsx
git commit -m "refactor(mobile): DetailSheetHeader supports optional actions + remove-from-activity"
```

---

## Task 6: FeedItemDetailSheet — deletion-notice variant

**Files:**
- Modify: `cost-share-app/apps/mobile/components/FeedItemDetailSheet.tsx`
- Modify: `cost-share-app/apps/mobile/__tests__/components/FeedItemDetailSheet.test.tsx`

- [ ] **Step 1: Read the existing test to learn the render helper**

```bash
sed -n '1,80p' cost-share-app/apps/mobile/__tests__/components/FeedItemDetailSheet.test.tsx
```
Note the helpers/imports used to mount the sheet. (We'll reuse the same `renderSheet`/`buildExpense` style; if names differ, adapt the new test to match.)

- [ ] **Step 2: Add failing tests for the deletion-notice variant**

Append to `__tests__/components/FeedItemDetailSheet.test.tsx`:

```tsx
import { fireEvent } from '@testing-library/react-native';

describe('FeedItemDetailSheet — deletion notice', () => {
    function renderDeleted(props: Partial<Parameters<typeof FeedItemDetailSheet>[0]> = {}) {
        const baseExpense = {
            id: 'e-del', groupId: 'g1', description: 'Dinner', amount: 120, currency: 'ILS',
            expenseDate: new Date('2026-06-18T18:00:00Z'), paidBy: 'u1', createdBy: 'u1',
            isDeleted: true, createdAt: new Date(), updatedAt: new Date(),
            splits: [], myDelta: 0, myDeltaState: 'settled' as const,
        };
        const onRemove = jest.fn();
        const onClose = jest.fn();
        const utils = render(
            <FeedItemDetailSheet
                item={{ kind: 'expense', expense: baseExpense }}
                memberMap={{ u1: { userId: 'u1', displayName: 'Avi', isActive: true } }}
                currentUserId="u-me"
                onClose={onClose}
                onEdit={() => {}}
                onDelete={() => {}}
                deletedNotice={{
                    deletedAt: new Date('2026-06-18T18:30:00Z'),
                    deletedByName: 'Avi',
                    kind: 'expense',
                }}
                onRemoveFromActivity={onRemove}
                {...props}
            />,
        );
        return { ...utils, onRemove, onClose };
    }

    it('shows the deletion notice body', () => {
        const { getByText } = renderDeleted();
        expect(getByText(/deleted by Avi/i)).toBeTruthy();
    });

    it('does not render Edit or Delete buttons', () => {
        const { queryByTestId } = renderDeleted();
        expect(queryByTestId('detail-edit-btn')).toBeNull();
        expect(queryByTestId('detail-delete-btn')).toBeNull();
    });

    it('renders the kebab with a Remove-from-activity action that fires onRemoveFromActivity', () => {
        const { getByTestId, onRemove } = renderDeleted();
        fireEvent.press(getByTestId('detail-kebab-btn'));
        fireEvent.press(getByTestId('detail-remove-from-activity-btn'));
        expect(onRemove).toHaveBeenCalled();
    });
});
```

- [ ] **Step 3: Run tests, confirm failure**

```bash
cd cost-share-app/apps/mobile
npx jest __tests__/components/FeedItemDetailSheet.test.tsx
```
Expected: 3 new tests fail — `deletedNotice` prop does not yet exist.

- [ ] **Step 4: Extend FeedItemDetailSheet — props and rendering**

In `cost-share-app/apps/mobile/components/FeedItemDetailSheet.tsx`:

(a) Extend the props interface (around the existing `FeedItemDetailSheetProps`, lines 67–77):

```tsx
export interface FeedItemDetailSheetProps {
    item: FeedDetailItem | null;
    memberMap: Record<string, GroupMemberLite>;
    currentUserId: string;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
    /** When set (e.g. from Activity feed), shows a link to open this item in the group. */
    onOpenInGroup?: () => void;
    openInGroupLabel?: string;
    /** When set, swaps the body for a deletion notice and disables Edit/Delete. */
    deletedNotice?: {
        deletedAt: Date;
        deletedByName: string;
        kind: 'expense' | 'settlement';
    };
    /** Required when deletedNotice is set; powers the kebab "Remove from activity" action. */
    onRemoveFromActivity?: () => void;
}
```

(b) Inside the component, accept the new props, gate the header actions, and render the notice instead of the live body. Replace the `DetailSheetHeader` invocation (currently around lines 189–200) with:

```tsx
{item && (
    <DetailSheetHeader
        label={
            item.kind === 'expense'
                ? t('groups.feedDetail.expenseHeaderLabel')
                : t('settleUp.detailHeaderLabel')
        }
        onClose={onClose}
        onEdit={deletedNotice ? undefined : onEdit}
        onDelete={deletedNotice ? undefined : onDelete}
        onRemoveFromActivity={deletedNotice ? onRemoveFromActivity : undefined}
    />
)}
```

(c) Replace the body switch (currently around lines 214–229) with:

```tsx
{deletedNotice ? (
    <DeletionNoticeBody
        deletedAt={deletedNotice.deletedAt}
        deletedByName={deletedNotice.deletedByName}
        kind={deletedNotice.kind}
        language={language}
    />
) : (
    <>
        {item?.kind === 'expense' && (
            <ExpenseDetailBody
                expense={item.expense}
                memberMap={memberMap}
                currentUserId={currentUserId}
                language={language}
            />
        )}
        {item?.kind === 'settlement' && (
            <SettlementDetailBody
                settlement={item.settlement}
                memberMap={memberMap}
                currentUserId={currentUserId}
                language={language}
            />
        )}
    </>
)}
```

(d) Add the `DeletionNoticeBody` helper near the other body components (after the existing `ExpenseDetailBody` / `SettlementDetailBody` declarations):

```tsx
function DeletionNoticeBody({
    deletedAt,
    deletedByName,
    kind,
    language,
}: {
    deletedAt: Date;
    deletedByName: string;
    kind: 'expense' | 'settlement';
    language: 'en' | 'he';
}) {
    const { t } = useTranslation();
    const formatter = new Intl.DateTimeFormat(language === 'he' ? 'he-IL' : 'en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    const when = formatter.format(deletedAt);
    const key = kind === 'expense'
        ? 'activity.deletionNotice.expense'
        : 'activity.deletionNotice.settlement';
    return (
        <View className="px-6 py-8 items-center" testID="feed-detail-deletion-notice">
            <AppIcon name="trash-outline" size={32} color={colors.gray500} />
            <Text className="text-center text-gray-700 mt-3 text-base">
                {t(key, { name: deletedByName, when })}
            </Text>
        </View>
    );
}
```

(e) Make sure the new component is destructured from props at the top of the function:

```tsx
export function FeedItemDetailSheet({
    item,
    memberMap,
    currentUserId,
    onClose,
    onEdit,
    onDelete,
    onOpenInGroup,
    openInGroupLabel,
    deletedNotice,
    onRemoveFromActivity,
}: FeedItemDetailSheetProps) {
```

- [ ] **Step 5: Run the tests, confirm they pass**

```bash
npx jest __tests__/components/FeedItemDetailSheet.test.tsx
```
Expected: all PASS.

- [ ] **Step 6: Typecheck**

```bash
cd ../..   # back to cost-share-app
npx tsc --noEmit -p apps/mobile/tsconfig.json
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add cost-share-app/apps/mobile/components/FeedItemDetailSheet.tsx \
        cost-share-app/apps/mobile/__tests__/components/FeedItemDetailSheet.test.tsx
git commit -m "feat(mobile): FeedItemDetailSheet deletion-notice variant"
```

---

## Task 7: ActivityFeedScreen — route deleted rows + wire Remove-from-activity

**Files:**
- Modify: `cost-share-app/apps/mobile/screens/activity/ActivityFeedScreen.tsx`

This task threads the new behaviour through the screen. There is no dedicated test file for this screen; correctness will be exercised by the end-to-end manual test plan and the underlying unit tests. Type checking + a fast read pass cover the wiring.

- [ ] **Step 1: Add the service import**

In `ActivityFeedScreen.tsx`, near the other service imports, add:

```tsx
import { removeActivityEvent } from '../../services/activityEvents.service';
import { platformAlert } from '../../lib/platformAlert';
```

- [ ] **Step 2: Track the active activity event id for the open detail**

Near the other `useState` declarations (around lines 144–146), add:

```tsx
const [detailEventId, setDetailEventId] = useState<string | null>(null);
const [detailDeletedNotice, setDetailDeletedNotice] = useState<
    { deletedAt: Date; deletedByName: string; kind: 'expense' | 'settlement' } | null
>(null);
```

- [ ] **Step 3: Resolve the deleter profile inside the existing profile-resolver effect**

Find the effect that resolves profiles for `from_user_id`, `to_user_id`, `new_member_user_id` (lines 162–176). Inside the `for (const evt of activities)` loop, add one more guarded push:

```tsx
            if (typeof md.deleted_by === 'string') ids.add(md.deleted_by);
```

- [ ] **Step 4: Update `openExpenseDetail` to handle the deleted path**

Replace the existing `openExpenseDetail` (lines 326–376) with:

```tsx
    const openExpenseDetail = useCallback(
        async (event: ActivityEvent) => {
            const md = (event.metadata ?? {}) as Record<string, unknown>;
            const seed = seedMemberMapFromGroup(event.groupId);
            const stub: ExpenseWithDelta = {
                id: event.refId,
                groupId: event.groupId ?? '',
                description: typeof md.description === 'string' ? md.description : '',
                amount: Number(md.amount ?? 0),
                currency: typeof md.currency === 'string' ? md.currency : '',
                expenseDate: typeof md.expense_date === 'string'
                    ? new Date(md.expense_date)
                    : event.createdAt,
                paidBy: event.actorUserId ?? '',
                createdBy: event.actorUserId ?? '',
                isDeleted: md.is_deleted === true,
                createdAt: event.createdAt,
                updatedAt: event.createdAt,
                splits: [],
                myDelta: 0,
                myDeltaState: 'settled',
            };
            setDetailMembers(seed);
            setDetailEventId(event.id);
            setDetailItem({ kind: 'expense', expense: stub });

            // Deleted row: skip the live fetch, surface the deletion notice.
            if (md.is_deleted === true) {
                const deletedById = typeof md.deleted_by === 'string' ? md.deleted_by : '';
                const deletedByName = deletedById === currentUser?.id
                    ? t('common.you')
                    : (profileMap[deletedById]?.displayName
                        ?? seed[deletedById]?.displayName
                        ?? t('common.unknown'));
                const deletedAt = typeof md.deleted_at === 'string'
                    ? new Date(md.deleted_at)
                    : event.createdAt;
                setDetailDeletedNotice({ deletedAt, deletedByName, kind: 'expense' });
                return;
            }
            setDetailDeletedNotice(null);

            const expense = await getExpenseWithSplitsById(event.refId);
            if (!expense) {
                setDetailItem(null);
                return;
            }
            const decorated = decorateExpense(expense, currentUser?.id ?? '');
            setDetailItem({ kind: 'expense', expense: decorated });
            const referencedIds = new Set<string>([
                expense.paidBy,
                expense.createdBy,
                ...expense.splits.map(s => s.userId),
            ].filter((id): id is string => Boolean(id)));
            const missing = [...referencedIds].filter(id => !seed[id]);
            if (missing.length > 0) {
                const extra = await fetchProfilesByUserIds(missing);
                if (Object.keys(extra).length > 0) {
                    setDetailMembers(prev => ({ ...prev, ...extra }));
                }
            }
        },
        [currentUser?.id, profileMap, seedMemberMapFromGroup, t],
    );
```

- [ ] **Step 5: Update `openSettlementDetail` symmetrically**

Replace `openSettlementDetail` (lines 378–419) with:

```tsx
    const openSettlementDetail = useCallback(
        async (event: ActivityEvent) => {
            const md = (event.metadata ?? {}) as Record<string, unknown>;
            const seed = seedMemberMapFromGroup(event.groupId);
            const stub: Settlement = {
                id: event.refId,
                groupId: event.groupId ?? '',
                fromUserId: typeof md.from_user_id === 'string' ? md.from_user_id : '',
                toUserId: typeof md.to_user_id === 'string' ? md.to_user_id : '',
                amount: Number(md.amount ?? 0),
                currency: typeof md.currency === 'string' ? md.currency : '',
                settlementDate: typeof md.settlement_date === 'string'
                    ? new Date(md.settlement_date)
                    : event.createdAt,
                createdBy: event.actorUserId ?? '',
                createdAt: event.createdAt,
                updatedAt: event.createdAt,
                deletedAt: md.is_deleted === true ? new Date() : null,
            };
            setDetailMembers(seed);
            setDetailEventId(event.id);
            setDetailItem({ kind: 'settlement', settlement: stub });

            if (md.is_deleted === true) {
                const deletedById = typeof md.deleted_by === 'string' ? md.deleted_by : '';
                const deletedByName = deletedById === currentUser?.id
                    ? t('common.you')
                    : (profileMap[deletedById]?.displayName
                        ?? seed[deletedById]?.displayName
                        ?? t('common.unknown'));
                const deletedAt = typeof md.deleted_at === 'string'
                    ? new Date(md.deleted_at)
                    : event.createdAt;
                setDetailDeletedNotice({ deletedAt, deletedByName, kind: 'settlement' });
                return;
            }
            setDetailDeletedNotice(null);

            const settlement = await getSettlementById(event.refId);
            if (!settlement) {
                setDetailItem(null);
                return;
            }
            setDetailItem({ kind: 'settlement', settlement });
            const referencedIds = new Set<string>([
                settlement.fromUserId,
                settlement.toUserId,
                settlement.createdBy,
            ].filter((id): id is string => Boolean(id)));
            const missing = [...referencedIds].filter(id => !seed[id]);
            if (missing.length > 0) {
                const extra = await fetchProfilesByUserIds(missing);
                if (Object.keys(extra).length > 0) {
                    setDetailMembers(prev => ({ ...prev, ...extra }));
                }
            }
        },
        [currentUser?.id, profileMap, seedMemberMapFromGroup, t],
    );
```

- [ ] **Step 6: Add the Remove-from-activity handler**

After the two openXDetail callbacks, add:

```tsx
    const handleRemoveFromActivity = useCallback(() => {
        if (!detailEventId) return;
        const eventId = detailEventId;
        platformAlert(t('activity.removeFromActivityConfirm'), undefined, [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('activity.removeFromActivity'),
                style: 'destructive',
                onPress: () => {
                    void (async () => {
                        const ok = await removeActivityEvent(eventId);
                        if (ok) {
                            setDetailItem(null);
                            setDetailDeletedNotice(null);
                            setDetailEventId(null);
                            void queryClient.invalidateQueries({
                                queryKey: queryKeys.activityFeed(),
                            });
                        }
                    })();
                },
            },
        ]);
    }, [detailEventId, queryClient, t]);
```

- [ ] **Step 7: Reset detail state on close**

Find the `<FeedItemDetailSheet … onClose={...}` invocation (around line 666). Update `onClose` to also clear the deletion-notice + event id, and pass the new props:

```tsx
            <FeedItemDetailSheet
                item={detailItem}
                memberMap={detailMembers}
                currentUserId={currentUser?.id ?? ''}
                onClose={() => {
                    setDetailItem(null);
                    setDetailDeletedNotice(null);
                    setDetailEventId(null);
                }}
                onEdit={/* existing */}
                onDelete={/* existing */}
                onOpenInGroup={detailOpenInGroup?.onPress}
                openInGroupLabel={detailOpenInGroup?.label}
                deletedNotice={detailDeletedNotice ?? undefined}
                onRemoveFromActivity={handleRemoveFromActivity}
            />
```

(If the existing call already wraps `onClose` in a function with extra cleanup, just merge our three setters into it; the rest of the props are unchanged.)

- [ ] **Step 8: Typecheck the whole mobile app**

```bash
cd cost-share-app
npx tsc --noEmit -p apps/mobile/tsconfig.json
```
Expected: PASS. If a closure references `queryKeys` without an import, add `import { queryKeys } from '../../hooks/queries/keys';` at the top.

- [ ] **Step 9: Run the existing screen-related tests**

```bash
cd apps/mobile
npx jest __tests__/components/ActivityItem.test.tsx __tests__/components/FeedItemDetailSheet.test.tsx
```
Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add cost-share-app/apps/mobile/screens/activity/ActivityFeedScreen.tsx
git commit -m "feat(mobile): activity feed routes deleted rows + remove-from-activity action"
```

---

## Task 8: Push render — edit/delete copy variants

**Files:**
- Modify: `cost-share-app/supabase/functions/send-push/render.ts`
- Modify: `cost-share-app/supabase/functions/send-push/render.test.ts`

- [ ] **Step 1: Write failing render tests**

Append to `cost-share-app/supabase/functions/send-push/render.test.ts`:

```ts
Deno.test('expense_added edited renders he', () => {
    const r = renderNotification('expense_added', 'he', {
        actorName: 'דנה', groupName: 'טיול', description: 'ארוחה', amount: 240, currency: 'ILS',
        isEdited: true,
    });
    assertEquals(r.title, 'טיול');
    assertEquals(r.body, 'דנה עדכנה הוצאה · ארוחה · ₪240');
});

Deno.test('expense_added edited renders en', () => {
    const r = renderNotification('expense_added', 'en', {
        actorName: 'Dana', groupName: 'Trip', description: 'Dinner', amount: 240, currency: 'ILS',
        isEdited: true,
    });
    assertEquals(r.body, 'Dana updated an expense · Dinner · ₪240');
});

Deno.test('expense_added deleted wins over edited', () => {
    const r = renderNotification('expense_added', 'en', {
        actorName: 'Dana', groupName: 'Trip', description: 'Dinner', amount: 240, currency: 'ILS',
        isEdited: true, isDeleted: true,
    });
    assertEquals(r.body, 'Dana deleted an expense · Dinner');
});

Deno.test('settlement_added edited en', () => {
    const r = renderNotification('settlement_added', 'en', {
        actorName: 'Dana', groupName: 'Trip', amount: 50, currency: 'ILS', isEdited: true,
    });
    assertEquals(r.body, 'Dana updated a payment · ₪50');
});

Deno.test('settlement_added deleted he', () => {
    const r = renderNotification('settlement_added', 'he', {
        actorName: 'דנה', groupName: 'טיול', amount: 50, currency: 'ILS', isDeleted: true,
    });
    assertEquals(r.body, 'דנה מחקה תשלום');
});

Deno.test('message_posted edited en uses neutral body', () => {
    const r = renderNotification('message_posted', 'en', {
        actorName: 'Dana', groupName: 'Trip', body: 'hi', isEdited: true,
    });
    assertEquals(r.title, 'Dana · Trip');
    assertEquals(r.body, 'Dana edited a message');
});

Deno.test('message_posted deleted he', () => {
    const r = renderNotification('message_posted', 'he', {
        actorName: 'דנה', groupName: 'טיול', body: 'שלום', isDeleted: true,
    });
    assertEquals(r.body, 'דנה מחקה הודעה');
});
```

- [ ] **Step 2: Run tests, confirm failure**

```bash
cd cost-share-app/supabase/functions/send-push
deno test --allow-env render.test.ts
```
Expected: 7 new tests fail — `isEdited` / `isDeleted` not in `RenderParams`.

- [ ] **Step 3: Implement the variants in render.ts**

Edit `render.ts`. Extend `RenderParams`:

```ts
export interface RenderParams {
    actorName: string;
    groupName: string;
    newMemberName?: string;
    description?: string | null;
    amount?: number | string | null;
    currency?: string | null;
    body?: string | null;
    isEdited?: boolean;
    isDeleted?: boolean;
}
```

Replace the three branches inside `renderNotification`:

```ts
        case 'expense_added': {
            if (p.isDeleted) {
                return {
                    title: p.groupName,
                    body: he
                        ? joinDot([`${p.actorName} מחקה הוצאה`, p.description])
                        : joinDot([`${p.actorName} deleted an expense`, p.description]),
                };
            }
            if (p.isEdited) {
                return {
                    title: p.groupName,
                    body: he
                        ? joinDot([`${p.actorName} עדכנה הוצאה`, p.description, money])
                        : joinDot([`${p.actorName} updated an expense`, p.description, money]),
                };
            }
            return {
                title: p.groupName,
                body: he
                    ? joinDot([`הוצאה חדשה מאת ${p.actorName}`, p.description, money])
                    : joinDot([`New expense from ${p.actorName}`, p.description, money]),
            };
        }
        case 'settlement_added': {
            if (p.isDeleted) {
                return {
                    title: p.groupName,
                    body: he
                        ? `${p.actorName} מחקה תשלום`
                        : `${p.actorName} deleted a payment`,
                };
            }
            if (p.isEdited) {
                return {
                    title: p.groupName,
                    body: he
                        ? joinDot([`${p.actorName} עדכנה תשלום`, money])
                        : joinDot([`${p.actorName} updated a payment`, money]),
                };
            }
            return {
                title: p.groupName,
                body: he
                    ? joinDot([`תשלום חדש מאת ${p.actorName}`, money])
                    : joinDot([`New payment from ${p.actorName}`, money]),
            };
        }
        case 'message_posted': {
            if (p.isDeleted) {
                return {
                    title: joinDot([p.actorName, p.groupName]),
                    body: he ? `${p.actorName} מחקה הודעה` : `${p.actorName} deleted a message`,
                };
            }
            if (p.isEdited) {
                return {
                    title: joinDot([p.actorName, p.groupName]),
                    body: he ? `${p.actorName} ערכה הודעה` : `${p.actorName} edited a message`,
                };
            }
            return { title: joinDot([p.actorName, p.groupName]), body: (p.body ?? '').trim() };
        }
```

- [ ] **Step 4: Run tests, confirm green**

```bash
deno test --allow-env render.test.ts
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add cost-share-app/supabase/functions/send-push/render.ts \
        cost-share-app/supabase/functions/send-push/render.test.ts
git commit -m "feat(push): edit/delete copy variants for activity push"
```

---

## Task 9: Push handler — forward is_edited / is_deleted

**Files:**
- Modify: `cost-share-app/supabase/functions/send-push/handler.ts`
- Modify: `cost-share-app/supabase/functions/send-push/handler.test.ts`

- [ ] **Step 1: Add a failing handler test that asserts the rendered body for an edited expense**

Append to `handler.test.ts`:

```ts
Deno.test('forwards is_edited metadata into renderNotification', async () => {
    const sentBodies: string[] = [];
    const deps = fakeDeps({
        sendExpo: (msgs) => {
            for (const m of msgs) sentBodies.push(m.body);
            return Promise.resolve({ ticketIds: ['t-1'], invalidTokens: [] });
        },
    });
    const record = baseRecord({
        metadata: { description: 'Lunch', amount: 50, currency: 'ILS', is_edited: true },
    });
    await processActivityEvent(record, deps);
    assertEquals(sentBodies[0], 'Dana updated an expense · Lunch · ₪50');
});

Deno.test('forwards is_deleted metadata into renderNotification', async () => {
    const sentBodies: string[] = [];
    const deps = fakeDeps({
        sendExpo: (msgs) => {
            for (const m of msgs) sentBodies.push(m.body);
            return Promise.resolve({ ticketIds: ['t-1'], invalidTokens: [] });
        },
    });
    const record = baseRecord({
        metadata: { description: 'Lunch', amount: 50, currency: 'ILS', is_deleted: true },
    });
    await processActivityEvent(record, deps);
    assertEquals(sentBodies[0], 'Dana deleted an expense · Lunch');
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
cd cost-share-app/supabase/functions/send-push
deno test --allow-env handler.test.ts
```
Expected: the two new tests fail — body still reads "New expense from Dana".

- [ ] **Step 3: Forward the flags in handler.ts**

In `handler.ts`, find the `renderNotification` call (lines 91–100). Update it to:

```ts
    const md = record.metadata ?? {};
    const rendered = renderNotification(record.kind, lang, {
        actorName: names.actorName,
        groupName: names.groupName,
        newMemberName: names.newMemberName,
        description: (md.description as string | undefined) ?? null,
        amount: (md.amount as number | string | undefined) ?? null,
        currency: (md.currency as string | undefined) ?? null,
        body: (md.body as string | undefined) ?? null,
        isEdited: md.is_edited === true,
        isDeleted: md.is_deleted === true,
    });
```

- [ ] **Step 4: Run tests, confirm green**

```bash
deno test --allow-env handler.test.ts render.test.ts expo.test.ts
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add cost-share-app/supabase/functions/send-push/handler.ts \
        cost-share-app/supabase/functions/send-push/handler.test.ts
git commit -m "feat(push): handler forwards is_edited/is_deleted flags to renderer"
```

---

## Task 10: Final verification + PR test plan

This is a verification-only task. No new code, only sanity checks and a PR test-plan checklist.

- [ ] **Step 1: Run the full mobile test suite**

```bash
cd cost-share-app/apps/mobile
npx jest
```
Expected: all PASS (or all unchanged failures from main — none caused by this branch).

- [ ] **Step 2: Run mobile typecheck**

```bash
cd cost-share-app
npx tsc --noEmit -p apps/mobile/tsconfig.json
```
Expected: PASS.

- [ ] **Step 3: Run the edge-function test suite**

```bash
cd cost-share-app/supabase/functions/send-push
deno test --allow-env
```
Expected: all PASS.

- [ ] **Step 4: Manual end-to-end on a dev device against `dev` Supabase**

Confirm with a second device or simulator:

1. **Expense edit.** Edit an existing expense. The row reappears at the top of Activity with " · Edited" suffix and the new amount/description; recipient(s) receive a push with body "Dana updated an expense · Dinner · ₪120".
2. **Expense delete.** Delete an expense. The row stays in Activity with " · Deleted" suffix, jumps to top; recipient(s) receive a push "Dana deleted an expense · Dinner".
3. **Open deleted expense.** Tap the deleted row. Popup opens with the deletion notice ("This expense was deleted by Dana on Jun 18, 8:30 PM"). No Edit/Delete actions in the kebab; only "Remove from activity".
4. **Remove from activity.** Confirm → row disappears from your feed; check the other device: row still present (per-user hide).
5. **Settlement parity.** Repeat 1–4 for a settlement.
6. **Message edit/delete parity.** Edit a message → " · Edited" appears on the activity row, push reads "Dana edited a message". Delete the message → " · Deleted" suffix; tapping is a no-op (out of scope for v1 popup).
7. **Self-events.** Editing/deleting your own item does NOT generate a push to you.

- [ ] **Step 5: Deploy the edge function to the dev environment**

```bash
cd cost-share-app
supabase functions deploy send-push --project-ref drxfbicunusmipdgbgdk
```

(Then re-run step 4 from a real device receiving real push notifications. Skip if the deploy is owned by CI for this repo — check `docs/SSOT/PUSH_NOTIFICATIONS_SETUP.md` for the canonical deploy procedure.)

- [ ] **Step 6: PR**

Open the PR with a body that includes the test plan from step 4 as a checklist, references the spec at `docs/superpowers/specs/2026-06-18-activity-edited-badge-design.md`, and calls out that the edge function must be redeployed alongside the migration so push copy matches the row state.

---

## Self-review notes

- Each spec requirement maps to a task:
  - Edit metadata flag → Task 1 (DB), Task 4 (badge), Task 8/9 (push).
  - Delete DELETE→UPDATE switch → Task 1.
  - RLS for per-user delete → Task 1.
  - "Remove from activity" service → Task 2.
  - Badge suffix → Task 4.
  - Deletion-notice popup (expense + settlement) → Task 6, wired in Task 7.
  - Kebab in popup → Task 5 (header generalised) + Task 6 (consumes it).
  - Push copy variants → Task 8 (render) + Task 9 (handler forwards flags).
  - i18n → Task 3.
  - Manual verification + deploy → Task 10.
- No `TBD` / "implement later" lines; every code-emitting step contains the actual code.
- Type / name consistency: `removeActivityEvent`, `onRemoveFromActivity`, `deletedNotice`, `isEdited`, `isDeleted` are used identically across tasks.
- Messages get the badge but not the deletion-notice popup (per spec decision 5). Task 7 does not need to route message rows to the new popup.
