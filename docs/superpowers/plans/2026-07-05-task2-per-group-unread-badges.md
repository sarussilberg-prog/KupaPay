# Per-Group Unread Badges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a per-group "new activity" unread badge on each group card in the Groups list, reusing the exact badge style already used on the Activity bottom-tab.

**Architecture:** A new `activity_group_last_seen` table plus two RPCs (`mark_group_activity_seen`, `get_group_unread_counts`) extend the existing `activity_events` watermark model to per-group granularity, inheriting the global `profiles.activity_last_seen_at` as the threshold for never-opened groups (anti-flood). A new React Query hook `useGroupUnreadCounts()` returns a `groupId → count` map, a shared `<UnreadBadge/>` component (extracted from `AppNavigator`) renders the pill on both the Activity tab and each `GroupCard`, and `GroupDetailScreen` calls mark-seen on focus then invalidates the counts query.

**Tech Stack:** Supabase Postgres (SECURITY DEFINER SQL RPCs, RLS), Expo React Native + TypeScript, `@tanstack/react-query`, Jest + `@testing-library/react-native`, plain PL/pgSQL SQL regression tests run via the Supabase MCP.

---

## File Structure

| File | New/Modified | Responsibility |
|------|--------------|----------------|
| `cost-share-app/supabase/migrations/20260705120000_activity_group_last_seen.sql` | **New** | Table `activity_group_last_seen` + RLS + RPCs `mark_group_activity_seen(uuid)` and `get_group_unread_counts()` + grants |
| `cost-share-app/supabase/__tests__/activity_group_last_seen.test.sql` | **New** | PL/pgSQL regression tests for the table, both RPCs, and the anti-flood threshold |
| `cost-share-app/apps/mobile/hooks/queries/keys.ts` | **Modified** | Add `groupUnreadCounts` query key |
| `cost-share-app/apps/mobile/hooks/queries/useGroupUnreadCounts.ts` | **New** | React Query hook → `Record<string, number>` (groupId → unread) |
| `cost-share-app/apps/mobile/__tests__/hooks/useGroupUnreadCounts.test.ts` | **New** | Hook test (mocks `supabase.rpc`) |
| `cost-share-app/apps/mobile/components/UnreadBadge.tsx` | **New** | Shared unread-count pill (extracted from `AppNavigator`) |
| `cost-share-app/apps/mobile/__tests__/components/UnreadBadge.test.tsx` | **New** | Component test (visibility, clamp at 99+) |
| `cost-share-app/apps/mobile/navigation/AppNavigator.tsx` | **Modified** | Replace inline Activity-tab badge JSX with `<UnreadBadge/>` (no visual regression) |
| `cost-share-app/apps/mobile/components/GroupCard.tsx` | **Modified** | Accept `unreadCount` prop, render `<UnreadBadge/>` on the card |
| `cost-share-app/apps/mobile/__tests__/components/GroupCard.test.tsx` | **Modified** | Add badge render/absence assertions |
| `cost-share-app/apps/mobile/screens/groups/GroupsListScreen.tsx` | **Modified** | Fetch counts via `useGroupUnreadCounts()`, pass each group's count into `GroupCard` |
| `cost-share-app/apps/mobile/screens/groups/GroupDetailScreen.tsx` | **Modified** | On focus: `mark_group_activity_seen(groupId)` then invalidate `groupUnreadCounts` |

---

## Conventions discovered (follow exactly)

- **Migration filename format:** `YYYYMMDDHHMMSS_snake_case.sql`. Latest existing is `20260701150000_consolidation_batches_realtime.sql`. New file uses `20260705120000_activity_group_last_seen.sql` (well ahead of all existing timestamps).
- **RPC conventions** (from `20260526105507_activity_events.sql`): `SECURITY DEFINER`, `SET search_path = public`, `LANGUAGE sql` for simple RPCs, `STABLE` for read RPCs, `REVOKE EXECUTE ... FROM PUBLIC, anon;` then `GRANT EXECUTE ... TO authenticated;`. All wrapped in a single `BEGIN; ... COMMIT;` transaction.
- **RLS style:** `ENABLE ROW LEVEL SECURITY`, `DROP POLICY IF EXISTS "..." ON <table>;` then `CREATE POLICY "..." ... USING (user_id = auth.uid())`.
- **SQL test style** (from `cost-share-app/supabase/__tests__/activity_events.test.sql`): a single `BEGIN; ... ROLLBACK;` transaction with `SET LOCAL session_replication_role = replica;` (disables FK checks + `auth.users` triggers), then a `DO $outer$ DECLARE ... BEGIN ... END $outer$;` block. Assertions are `IF <bad condition> THEN RAISE EXCEPTION 'Case N failed: ...', args; END IF;`. Ends with `RAISE NOTICE 'All ... tests passed.'`. Force `auth.uid()` via `PERFORM set_config('request.jwt.claim.sub', v_user::text, true);`. Seed users into `auth.users` then `public.profiles` (columns: `id, email, name, default_currency, language, is_active, invite_token`), `public.groups` (`id, name, default_currency, created_by, is_active, group_type, invite_token`). NOT pgTAP — plain PL/pgSQL raises.
- **Applying/testing migrations:** dev project `drxfbicunusmipdgbgdk` FIRST via the `supabase` MCP, prod `jfqxjjjbpxbwwvoygahu` only after user approval via the `supabase-prod` MCP. This plan is a document — do NOT apply anything until executing.
- **Hook test style** (from `__tests__/services/activityEvents.service.test.ts`): `jest.mock('../../lib/supabase', () => ({ supabase: { rpc: ... }, __mocks: {...} }))`, then drive resolved values per test. Store access mocked via `jest.mock('../../store', ...)`.
- **Component test style** (from `__tests__/components/GroupCard.test.tsx`): `render(...)` from `@testing-library/react-native`, `getByText` / `getByTestId` / `queryByTestId`.

---

## Task 1 — SQL migration: `activity_group_last_seen` table + RLS + both RPCs + grants

**Files:**
- Test: `cost-share-app/supabase/__tests__/activity_group_last_seen.test.sql` (new)
- Impl: `cost-share-app/supabase/migrations/20260705120000_activity_group_last_seen.sql` (new)
- Reference: `cost-share-app/supabase/migrations/20260526105507_activity_events.sql` (lines 88-116 for RPC/grant conventions; lines 62-68 for RLS)
- Reference: `cost-share-app/supabase/__tests__/activity_events.test.sql` (lines 20-236 for test scaffold)

TDD note: SQL migrations are applied to the live dev project via the Supabase MCP; there is no local `psql`. So the "failing test" step runs the `.test.sql` against dev BEFORE the migration is applied — it must fail because the objects don't exist yet. Then apply the migration, then re-run the same test and expect it to pass.

- [ ] Write the failing SQL test file `cost-share-app/supabase/__tests__/activity_group_last_seen.test.sql`:

```sql
-- ============================================================================
-- SQL regression tests for activity_group_last_seen + per-group unread RPCs.
--
-- Run via Supabase MCP:
--   mcp__supabase__execute_sql with the full contents below against the dev
--   project (drxfbicunusmipdgbgdk). The transaction ROLLBACKs at the end so
--   no data persists.
--
-- session_replication_role = replica disables the auth.users trigger and FK
-- checks so we can seed synthetic users. The activity_events triggers must be
-- re-enabled explicitly because we rely on them to fan out an expense into
-- activity_events rows that the unread count then reads.
-- ============================================================================

BEGIN;

SET LOCAL session_replication_role = replica;

ALTER TABLE expenses      ENABLE ALWAYS TRIGGER trg_expense_activity_events;
ALTER TABLE group_members ENABLE ALWAYS TRIGGER trg_group_membership_activity_events;

DO $outer$
DECLARE
    -- Hex-only UUIDs (a95 = "activity group seen" mnemonic).
    v_group1  CONSTANT UUID := '00000000-0000-0000-0000-00000000a951';
    v_group2  CONSTANT UUID := '00000000-0000-0000-0000-00000000a952';
    v_alice   CONSTANT UUID := '00000000-0000-0000-0000-0000000a95a1';
    v_bob     CONSTANT UUID := '00000000-0000-0000-0000-0000000a95b1';
    v_count   INT;
    v_unread1 INT;
    v_unread2 INT;
    v_seen    TIMESTAMPTZ;
BEGIN
    -- ---- seed ----------------------------------------------------------
    INSERT INTO auth.users (id) VALUES (v_alice), (v_bob);
    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token)
    VALUES
        (v_alice, 'ags-alice@test.local', 'Alice', 'USD', 'en', TRUE, 'tt_ags_alice'),
        (v_bob,   'ags-bob@test.local',   'Bob',   'USD', 'en', TRUE, 'tt_ags_bob');
    -- Global watermark to epoch so all seeded events count as "new".
    UPDATE public.profiles SET activity_last_seen_at = 'epoch'::timestamptz WHERE id = v_alice;

    INSERT INTO public.groups (id, name, default_currency, created_by, is_active, group_type, invite_token)
    VALUES
        (v_group1, 'AGS Group 1', 'USD', v_bob, TRUE, 'general', 'tt_ags_g1'),
        (v_group2, 'AGS Group 2', 'USD', v_bob, TRUE, 'general', 'tt_ags_g2');

    -- Bob is founder; add Alice + Bob as active members of both groups.
    INSERT INTO public.group_members (group_id, user_id, is_active, joined_at, added_by)
    VALUES
        (v_group1, v_bob,   TRUE, now(), NULL),
        (v_group1, v_alice, TRUE, now(), v_bob),
        (v_group2, v_bob,   TRUE, now(), NULL),
        (v_group2, v_alice, TRUE, now(), v_bob);

    -- Bob adds one expense in each group → each fans out to an
    -- expense_added row for Alice with actor_user_id = Bob (counts as unread).
    INSERT INTO public.expenses (group_id, paid_by, amount, currency, description, expense_date, created_by, is_deleted)
    VALUES (v_group1, v_bob, 10, 'USD', 'G1 lunch', CURRENT_DATE, v_bob, FALSE);
    INSERT INTO public.expenses (group_id, paid_by, amount, currency, description, expense_date, created_by, is_deleted)
    VALUES (v_group2, v_bob, 20, 'USD', 'G2 lunch', CURRENT_DATE, v_bob, FALSE);

    -- Alice self-adds an expense in group1 → actor = Alice, must NOT count.
    INSERT INTO public.expenses (group_id, paid_by, amount, currency, description, expense_date, created_by, is_deleted)
    VALUES (v_group1, v_alice, 5, 'USD', 'Alice own', CURRENT_DATE, v_alice, FALSE);

    -- Act as Alice for auth.uid().
    PERFORM set_config('request.jwt.claim.sub', v_alice::text, true);

    -- ---- CASE 1: get_group_unread_counts returns a row per group with unread>0
    SELECT unread INTO v_unread1 FROM get_group_unread_counts() WHERE group_id = v_group1;
    SELECT unread INTO v_unread2 FROM get_group_unread_counts() WHERE group_id = v_group2;
    IF v_unread1 <> 1 THEN
        RAISE EXCEPTION 'Case 1 failed: expected 1 unread in group1 (Bob''s expense only), got %', v_unread1;
    END IF;
    IF v_unread2 <> 1 THEN
        RAISE EXCEPTION 'Case 1 failed: expected 1 unread in group2, got %', v_unread2;
    END IF;

    -- ---- CASE 2: own actions are not counted (group1 has 2 events for Alice:
    --             Bob''s expense + Alice''s own expense; only Bob''s counts).
    SELECT COUNT(*) INTO v_count FROM activity_events
    WHERE user_id = v_alice AND group_id = v_group1 AND kind = 'expense_added';
    IF v_count <> 2 THEN
        RAISE EXCEPTION 'Case 2 setup wrong: expected 2 expense_added rows for Alice in group1, got %', v_count;
    END IF;
    IF v_unread1 <> 1 THEN
        RAISE EXCEPTION 'Case 2 failed: own expense leaked into unread (unread=%, total=%)', v_unread1, v_count;
    END IF;

    -- ---- CASE 3: mark_group_activity_seen(group1) upserts seen_at ~ now(),
    --             clearing group1''s unread while group2 is untouched.
    PERFORM mark_group_activity_seen(v_group1);

    SELECT seen_at INTO v_seen FROM activity_group_last_seen
    WHERE user_id = v_alice AND group_id = v_group1;
    IF v_seen IS NULL OR v_seen < now() - interval '1 minute' THEN
        RAISE EXCEPTION 'Case 3 failed: seen_at not set to ~now() (%)', v_seen;
    END IF;

    v_unread1 := NULL;
    SELECT unread INTO v_unread1 FROM get_group_unread_counts() WHERE group_id = v_group1;
    IF COALESCE(v_unread1, 0) <> 0 THEN
        RAISE EXCEPTION 'Case 3 failed: group1 unread not cleared after mark seen, got %', v_unread1;
    END IF;

    SELECT unread INTO v_unread2 FROM get_group_unread_counts() WHERE group_id = v_group2;
    IF v_unread2 <> 1 THEN
        RAISE EXCEPTION 'Case 3 failed: group2 unread changed unexpectedly, got %', v_unread2;
    END IF;

    -- ---- CASE 4: idempotent upsert — calling mark again keeps a single row.
    PERFORM mark_group_activity_seen(v_group1);
    SELECT COUNT(*) INTO v_count FROM activity_group_last_seen
    WHERE user_id = v_alice AND group_id = v_group1;
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'Case 4 failed: expected 1 last_seen row after 2 marks, got %', v_count;
    END IF;

    -- ---- CASE 5: anti-flood — a group with NO last_seen row inherits the
    --             GLOBAL watermark. Advance Alice''s global watermark past all
    --             events; group2 (never marked) must then read 0 unread.
    UPDATE public.profiles SET activity_last_seen_at = now() WHERE id = v_alice;
    v_unread2 := NULL;
    SELECT unread INTO v_unread2 FROM get_group_unread_counts() WHERE group_id = v_group2;
    IF COALESCE(v_unread2, 0) <> 0 THEN
        RAISE EXCEPTION 'Case 5 failed: never-opened group did not inherit global watermark, got %', v_unread2;
    END IF;

    RAISE NOTICE 'All activity_group_last_seen tests passed.';
END
$outer$;

ROLLBACK;
```

- [ ] Run the test against dev and expect failure (objects don't exist yet). Use the `supabase` MCP tool `mcp__supabase__execute_sql` with the full file contents. Expected error (RPC missing):

```
ERROR: 42883: function get_group_unread_counts() does not exist
```

- [ ] Write the migration `cost-share-app/supabase/migrations/20260705120000_activity_group_last_seen.sql`:

```sql
-- 2026-07-05 — Per-group activity "last seen" watermark + unread-count RPCs.
--
-- Extends the global activity watermark (profiles.activity_last_seen_at,
-- added in 20260526105507_activity_events.sql) to per-group granularity so the
-- Groups list can show a per-group unread badge.
--
-- Apply order (per docs/SSOT/SUPABASE_ENVIRONMENTS.md):
--   1. dev   (drxfbicunusmipdgbgdk)  — first, via the `supabase` MCP.
--   2. prod  (jfqxjjjbpxbwwvoygahu)  — only after explicit user approval,
--                                       via the `supabase-prod` MCP.

BEGIN;

-- ============================================================================
-- 1. activity_group_last_seen — per (user, group) "I've seen up to" watermark.
--    Absent row means the group was never opened; unread then falls back to the
--    global profiles.activity_last_seen_at (anti-flood: no historic surge).
-- ============================================================================
CREATE TABLE IF NOT EXISTS activity_group_last_seen (
    user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, group_id)
);

-- RLS: users read only their own watermarks; only the SECURITY DEFINER RPC writes.
ALTER TABLE activity_group_last_seen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own group last seen" ON activity_group_last_seen;
CREATE POLICY "Users read own group last seen"
    ON activity_group_last_seen FOR SELECT
    USING (user_id = auth.uid());

-- ============================================================================
-- 2. mark_group_activity_seen — upsert seen_at = now() for the caller/group.
-- ============================================================================
CREATE OR REPLACE FUNCTION mark_group_activity_seen(p_group_id UUID) RETURNS void
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public
    AS $$
        INSERT INTO activity_group_last_seen (user_id, group_id, seen_at)
        VALUES (auth.uid(), p_group_id, NOW())
        ON CONFLICT (user_id, group_id)
        DO UPDATE SET seen_at = NOW();
    $$;

-- ============================================================================
-- 3. get_group_unread_counts — setof (group_id, unread) for the caller.
--    Threshold per group = coalesce(per-group seen_at, global watermark), so a
--    never-opened group inherits the global last-seen. Mirrors the global count:
--    actor_user_id <> auth.uid() excludes the user's own actions AND NULL-actor
--    events (NULL <> uuid → NULL, falsy in WHERE). Only rows with unread > 0.
-- ============================================================================
CREATE OR REPLACE FUNCTION get_group_unread_counts()
    RETURNS TABLE (group_id UUID, unread INTEGER)
    LANGUAGE sql
    SECURITY DEFINER STABLE
    SET search_path = public
    AS $$
        SELECT
            ae.group_id,
            COUNT(*)::integer AS unread
        FROM activity_events ae
        JOIN profiles p ON p.id = ae.user_id
        LEFT JOIN activity_group_last_seen gls
            ON gls.user_id = ae.user_id
           AND gls.group_id = ae.group_id
        WHERE ae.user_id = auth.uid()
          AND ae.group_id IS NOT NULL
          AND ae.actor_user_id <> auth.uid()
          AND ae.created_at > COALESCE(gls.seen_at, p.activity_last_seen_at)
        GROUP BY ae.group_id;
    $$;

REVOKE EXECUTE ON FUNCTION mark_group_activity_seen(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION get_group_unread_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION mark_group_activity_seen(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_group_unread_counts() TO authenticated;

COMMIT;
```

- [ ] Apply the migration to dev via `mcp__supabase__apply_migration` (name: `activity_group_last_seen`, query: the file contents above).
- [ ] Re-run the SQL test against dev via `mcp__supabase__execute_sql` and expect success. Expected notice:

```
NOTICE: All activity_group_last_seen tests passed.
```

- [ ] Commit:

```
feat(activity): per-group last-seen table + unread-count RPCs

Add activity_group_last_seen (user_id, group_id, seen_at) with RLS,
mark_group_activity_seen(uuid) upsert, and get_group_unread_counts()
which inherits the global watermark for never-opened groups.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

> **Prod:** After the user approves, apply the same migration to prod via `mcp__supabase-prod__apply_migration` and run the same test via `mcp__supabase-prod__execute_sql`. Do NOT do this without explicit approval.

---

## Task 2 — Client hook `useGroupUnreadCounts()` (+ query key)

**Files:**
- Test: `cost-share-app/apps/mobile/__tests__/hooks/useGroupUnreadCounts.test.ts` (new)
- Impl: `cost-share-app/apps/mobile/hooks/queries/useGroupUnreadCounts.ts` (new)
- Impl: `cost-share-app/apps/mobile/hooks/queries/keys.ts` (modified — add key after line 6)
- Reference: `cost-share-app/apps/mobile/hooks/queries/useActivityUnreadCount.ts` (lines 1-25, mirror this)

- [ ] Write the failing hook test `cost-share-app/apps/mobile/__tests__/hooks/useGroupUnreadCounts.test.ts`:

```ts
import { renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rpc = jest.fn();
jest.mock('../../lib/supabase', () => ({ supabase: { rpc } }));

jest.mock('../../store', () => ({
    useAppStore: (selector: (s: unknown) => unknown) =>
        selector({ currentUser: { id: 'me' } }),
}));

import { useGroupUnreadCounts } from '../../hooks/queries/useGroupUnreadCounts';

function wrapper({ children }: { children: React.ReactNode }) {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return React.createElement(QueryClientProvider, { client }, children);
}

describe('useGroupUnreadCounts', () => {
    beforeEach(() => rpc.mockReset());

    it('maps the RPC rows into a groupId -> unread record', async () => {
        rpc.mockResolvedValueOnce({
            data: [
                { group_id: 'g1', unread: 3 },
                { group_id: 'g2', unread: 1 },
            ],
            error: null,
        });
        const { result } = renderHook(() => useGroupUnreadCounts(), { wrapper });
        await waitFor(() => expect(result.current.data).toBeDefined());
        expect(rpc).toHaveBeenCalledWith('get_group_unread_counts');
        expect(result.current.data).toEqual({ g1: 3, g2: 1 });
    });

    it('returns an empty map when the RPC errors', async () => {
        rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
        const { result } = renderHook(() => useGroupUnreadCounts(), { wrapper });
        await waitFor(() => expect(result.current.data).toEqual({}));
    });
});
```

- [ ] Run the test and expect failure (module does not exist yet):

```
cd cost-share-app/apps/mobile && npx jest __tests__/hooks/useGroupUnreadCounts.test.ts --watchman=false
```

Expected output:

```
Cannot find module '../../hooks/queries/useGroupUnreadCounts' from '__tests__/hooks/useGroupUnreadCounts.test.ts'
```

- [ ] Add the query key to `cost-share-app/apps/mobile/hooks/queries/keys.ts` (insert immediately after the `activityUnreadCount` line, currently line 6):

```ts
    groupUnreadCounts: ['activity', 'group-unread-counts'] as const,
```

- [ ] Create `cost-share-app/apps/mobile/hooks/queries/useGroupUnreadCounts.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store';
import { queryKeys } from './keys';

const UNREAD_STALE_MS = 30_000;

type GroupUnreadRow = { group_id: string; unread: number };

/** Map of groupId → unread activity count for the current user. */
export type GroupUnreadCounts = Record<string, number>;

async function fetchGroupUnreadCounts(): Promise<GroupUnreadCounts> {
    const { data, error } = await supabase.rpc('get_group_unread_counts');
    if (error) {
        console.error('Failed to fetch group unread counts:', error);
        return {};
    }
    const rows = (data ?? []) as GroupUnreadRow[];
    const out: GroupUnreadCounts = {};
    for (const row of rows) {
        out[row.group_id] = row.unread;
    }
    return out;
}

export function useGroupUnreadCounts() {
    const currentUserId = useAppStore(s => s.currentUser?.id);
    return useQuery({
        queryKey: queryKeys.groupUnreadCounts,
        queryFn: fetchGroupUnreadCounts,
        enabled: Boolean(currentUserId),
        staleTime: UNREAD_STALE_MS,
    });
}
```

- [ ] Run the test and expect pass:

```
cd cost-share-app/apps/mobile && npx jest __tests__/hooks/useGroupUnreadCounts.test.ts --watchman=false
```

Expected: `Tests: 2 passed, 2 total`.

- [ ] Commit:

```
feat(mobile): useGroupUnreadCounts hook + query key

React Query hook wrapping get_group_unread_counts(), returning a
groupId -> unread map. Mirrors useActivityUnreadCount.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

## Task 3 — Shared `<UnreadBadge/>` component (extract from AppNavigator, reuse on Activity tab)

**Files:**
- Test: `cost-share-app/apps/mobile/__tests__/components/UnreadBadge.test.tsx` (new)
- Impl: `cost-share-app/apps/mobile/components/UnreadBadge.tsx` (new)
- Impl: `cost-share-app/apps/mobile/navigation/AppNavigator.tsx` (modified — replace the inline badge at lines 287-313; add import near line 22)
- Reference: `cost-share-app/apps/mobile/navigation/AppNavigator.tsx` (lines 281-315 — the exact style being extracted)
- Reference: `cost-share-app/apps/mobile/theme/colors.ts` (line 12 `primaryDark: '#3B82F6'`, line 14 `primaryExtraLight: '#DBEAFE'`)

The extracted component must reproduce the exact styles: `minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: colors.primaryExtraLight`; text `color: colors.primaryDark, fontSize: 10, fontWeight: '600', lineHeight: 12`; clamp `> 99` to `'99+'`; render nothing when count `<= 0`. On the Activity tab it stays absolutely positioned via a wrapper (keep `position: 'absolute', top: -6, right: -10` on the badge so the tab layout is unchanged); on `GroupCard` it renders inline. To keep both callers happy, the absolute-position style is passed by the caller via a `style` prop.

- [ ] Write the failing component test `cost-share-app/apps/mobile/__tests__/components/UnreadBadge.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { UnreadBadge } from '../../components/UnreadBadge';

describe('UnreadBadge', () => {
    it('renders the count when > 0', () => {
        const { getByText } = render(<UnreadBadge count={3} />);
        expect(getByText('3')).toBeTruthy();
    });

    it('renders nothing when count is 0', () => {
        const { queryByTestId } = render(<UnreadBadge count={0} />);
        expect(queryByTestId('unread-badge')).toBeNull();
    });

    it('clamps counts over 99 to "99+"', () => {
        const { getByText } = render(<UnreadBadge count={150} />);
        expect(getByText('99+')).toBeTruthy();
    });
});
```

- [ ] Run and expect failure (module missing):

```
cd cost-share-app/apps/mobile && npx jest __tests__/components/UnreadBadge.test.tsx --watchman=false
```

Expected:

```
Cannot find module '../../components/UnreadBadge' from '__tests__/components/UnreadBadge.test.tsx'
```

- [ ] Create `cost-share-app/apps/mobile/components/UnreadBadge.tsx`:

```tsx
/**
 * UnreadBadge — small pill showing an unread activity count.
 * Shared by the Activity bottom-tab icon and each GroupCard on the Groups list.
 * Renders nothing when count <= 0; clamps counts over 99 to "99+".
 */

import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { Text } from './AppText';
import { colors } from '../theme';

interface UnreadBadgeProps {
    count: number;
    /** Extra positioning (e.g. absolute placement over the tab icon). */
    style?: StyleProp<ViewStyle>;
}

export function UnreadBadge({ count, style }: UnreadBadgeProps) {
    if (count <= 0) return null;
    return (
        <View
            testID="unread-badge"
            style={[
                {
                    minWidth: 16,
                    height: 16,
                    paddingHorizontal: 4,
                    borderRadius: 8,
                    backgroundColor: colors.primaryExtraLight,
                    justifyContent: 'center',
                    alignItems: 'center',
                },
                style,
            ]}
        >
            <Text
                style={{
                    color: colors.primaryDark,
                    fontSize: 10,
                    fontWeight: '600',
                    lineHeight: 12,
                }}
            >
                {count > 99 ? '99+' : count}
            </Text>
        </View>
    );
}
```

- [ ] Run and expect pass:

```
cd cost-share-app/apps/mobile && npx jest __tests__/components/UnreadBadge.test.tsx --watchman=false
```

Expected: `Tests: 3 passed, 3 total`.

- [ ] Add the import to `cost-share-app/apps/mobile/navigation/AppNavigator.tsx` (after line 22, `import { AppIcon, AppIconName } from '../components/AppIcon';`):

```ts
import { UnreadBadge } from '../components/UnreadBadge';
```

- [ ] Replace the inline Activity-tab badge in `cost-share-app/apps/mobile/navigation/AppNavigator.tsx`. Change the `tabBarIcon` (currently lines 280-314) so the block from `{unreadCount > 0 && ( ... )}` becomes a single `<UnreadBadge/>`. New `tabBarIcon`:

```tsx
                    tabBarIcon: ({ color, size, focused }) => (
                        <View>
                            <AppIcon
                                name={focused ? 'time' : 'time-outline'}
                                size={size}
                                color={color}
                            />
                            <UnreadBadge
                                count={unreadCount}
                                style={{ position: 'absolute', top: -6, right: -10 }}
                            />
                        </View>
                    ),
```

- [ ] Run the full existing suite to confirm no regression in navigation/badge rendering:

```
cd cost-share-app/apps/mobile && npx jest __tests__/components/UnreadBadge.test.tsx --watchman=false
```

Expected: all green (the badge component test still passes; the tab now delegates to it).

- [ ] Commit:

```
refactor(mobile): extract shared UnreadBadge; reuse on Activity tab

No visual change — the Activity-tab badge now renders via <UnreadBadge/>
with the same style, positioned absolutely by the caller.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

## Task 4 — Render badge on `GroupCard` via `GroupsListScreen` data

**Files:**
- Test: `cost-share-app/apps/mobile/__tests__/components/GroupCard.test.tsx` (modified — add cases after line 118)
- Impl: `cost-share-app/apps/mobile/components/GroupCard.tsx` (modified — add prop at line 27-28, render at lines 92-113 region, import UnreadBadge near line 15)
- Impl: `cost-share-app/apps/mobile/screens/groups/GroupsListScreen.tsx` (modified — import + hook near lines 24/82, pass prop in `renderGroupRow` lines 214-229)
- Reference: `cost-share-app/apps/mobile/components/GroupCard.tsx` (lines 18-134 — current props + JSX)
- Reference: `cost-share-app/apps/mobile/screens/groups/GroupsListScreen.tsx` (lines 214-229 — `renderGroupRow`)

The badge sits on the name row, after the group name, before the archived badge (uses the existing `marginStart: 'auto'` spacer pattern). Place it so it visually hugs the name.

- [ ] Add the failing GroupCard tests to `cost-share-app/apps/mobile/__tests__/components/GroupCard.test.tsx` (append inside the `describe('GroupCard', ...)` block, before its closing `});` on line 119):

```tsx
    it('renders an unread badge when unreadCount > 0', () => {
        const { getByTestId } = render(
            <GroupCard group={baseGroup} unreadCount={4} onPress={() => {}} />,
        );
        expect(getByTestId('unread-badge')).toBeTruthy();
    });

    it('does not render an unread badge when unreadCount is 0 or undefined', () => {
        const { queryByTestId } = render(
            <GroupCard group={baseGroup} onPress={() => {}} />,
        );
        expect(queryByTestId('unread-badge')).toBeNull();
    });
```

- [ ] Run and expect failure (prop not wired, badge never renders):

```
cd cost-share-app/apps/mobile && npx jest __tests__/components/GroupCard.test.tsx --watchman=false
```

Expected failure on the first new case:

```
Unable to find an element with testID: unread-badge
```

- [ ] Add the import to `cost-share-app/apps/mobile/components/GroupCard.tsx` (after line 15, `import { HighlightedText } from './HighlightedText';`):

```ts
import { UnreadBadge } from './UnreadBadge';
```

- [ ] Add the `unreadCount` prop to the `GroupCardProps` interface in `cost-share-app/apps/mobile/components/GroupCard.tsx` (after line 27, `matchedMemberNames?: string[];`):

```ts
    /** Count of new activity events in this group since last opened. */
    unreadCount?: number;
```

- [ ] Destructure it in `GroupCardBase` (add `unreadCount,` to the destructured props at lines 30-38, after `matchedMemberNames,`):

```ts
    matchedMemberNames,
    unreadCount,
    onPress,
```

- [ ] Render the badge in the name row of `cost-share-app/apps/mobile/components/GroupCard.tsx`. Inside the `<View style={[rtlRowStyle(isRtl), { alignItems: 'center' }]}>` name row (lines 65-92), insert the badge right after the `HighlightedText` wrapper `View` (after line 77's closing `</View>`, before the `{isArchived && ...}` block at line 78):

```tsx
                        {!isArchived && (unreadCount ?? 0) > 0 && (
                            <UnreadBadge
                                count={unreadCount ?? 0}
                                style={{ marginStart: 8, marginEnd: 4 }}
                            />
                        )}
```

- [ ] Run and expect pass:

```
cd cost-share-app/apps/mobile && npx jest __tests__/components/GroupCard.test.tsx --watchman=false
```

Expected: all GroupCard tests green (original 9 + 2 new = 11 passing).

- [ ] Wire the data in `cost-share-app/apps/mobile/screens/groups/GroupsListScreen.tsx`. Add the import (after line 24, `import { prefetchActivityFeed } from '../../hooks/queries/useActivityQuery';`):

```ts
import { useGroupUnreadCounts } from '../../hooks/queries/useGroupUnreadCounts';
```

- [ ] Call the hook in `GroupsListScreen` (after line 82, `const { data: simplified } = useSimplifiedDebts();`):

```ts
    const { data: unreadByGroup } = useGroupUnreadCounts();
```

- [ ] Pass the count into each card in `renderGroupRow` (in `cost-share-app/apps/mobile/screens/groups/GroupsListScreen.tsx`, lines 214-229). Add the prop to the `<GroupCard ...>` JSX (after the `matchedMemberNames={...}` prop, before `onPress={handleGroupPress}`):

```tsx
                unreadCount={unreadByGroup?.[item.group.id] ?? 0}
```

And add `unreadByGroup` to the `useCallback` dependency array on line 228:

```ts
        [simplified, balanceUnknown, groupHasOpenDebts, unreadByGroup, trimmedQuery, handleGroupPress],
```

- [ ] Run the full mobile test suite to confirm no regressions:

```
cd cost-share-app/apps/mobile && npx jest __tests__/components/GroupCard.test.tsx __tests__/hooks/useGroupUnreadCounts.test.ts __tests__/components/UnreadBadge.test.tsx --watchman=false
```

Expected: all green.

- [ ] Commit:

```
feat(mobile): per-group unread badge on GroupCard

GroupsListScreen fetches useGroupUnreadCounts() and passes each group's
count into GroupCard, which renders the shared <UnreadBadge/>.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

## Task 5 — mark-seen on `GroupDetailScreen` focus + query invalidation

**Files:**
- Impl: `cost-share-app/apps/mobile/screens/groups/GroupDetailScreen.tsx` (modified — add `useFocusEffect` import near lines 20/55; add effect after line 226)
- Reference: `cost-share-app/apps/mobile/screens/activity/ActivityFeedScreen.tsx` (lines 261-281 — the exact mark-seen-on-focus pattern to mirror)
- Reference: `cost-share-app/apps/mobile/screens/groups/GroupDetailScreen.tsx` (lines 193-226 — component head; `groupId` from route params at line 199; imports at lines 20, 46, 55-56)

`GroupDetailScreen` already imports `useNavigation, useRoute` from `@react-navigation/native` (line 20), `queryClient` (line 55), `queryKeys` (line 56), and `useCallback` (line 6). It does NOT yet import `supabase` — that import must be added. Also add `useFocusEffect` to the existing `@react-navigation/native` import.

- [ ] Add `useFocusEffect` to the existing import in `cost-share-app/apps/mobile/screens/groups/GroupDetailScreen.tsx` (line 20):

```ts
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
```

- [ ] Add the `supabase` import to `GroupDetailScreen.tsx` (it is not currently imported). Add after line 55 (`import { queryClient } from '../../lib/queryClient';`):

```ts
import { supabase } from '../../lib/supabase';
```

- [ ] Add the mark-seen focus effect in `GroupDetailScreen` (in `cost-share-app/apps/mobile/screens/groups/GroupDetailScreen.tsx`, after the cleanup `useEffect` that ends at line 226, and after `groupId` is in scope from line 199). Insert:

```tsx
    // On focus, mark this group's activity as seen and refresh the per-group
    // unread badge on the Groups list. Mirrors ActivityFeedScreen's global
    // mark_activity_seen on focus.
    useFocusEffect(
        useCallback(() => {
            void (async () => {
                const { error } = await supabase.rpc('mark_group_activity_seen', {
                    p_group_id: groupId,
                });
                if (!error) {
                    void queryClient.invalidateQueries({
                        queryKey: queryKeys.groupUnreadCounts,
                    });
                }
            })();
        }, [groupId]),
    );
```

- [ ] Manual verification note (no automated test — `GroupDetailScreen` has no existing screen test harness and mounting it pulls in realtime + many queries). Run the typecheck + lint to confirm the edits compile:

```
cd cost-share-app/apps/mobile && npx tsc --noEmit
```

Expected: no new type errors from the edited files.

- [ ] Manual smoke (documented, run when a build is available): open a group that shows a badge on the Groups list → badge disappears after returning to the list (mark-seen fired + counts invalidated); a group with only your own recent activity never shows a badge.

- [ ] Commit:

```
feat(mobile): mark group activity seen on GroupDetail focus

On focus, call mark_group_activity_seen(groupId) and invalidate the
groupUnreadCounts query so the per-group badge clears.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

## Final verification

- [ ] Run the four relevant test files together:

```
cd cost-share-app/apps/mobile && npx jest __tests__/hooks/useGroupUnreadCounts.test.ts __tests__/components/UnreadBadge.test.tsx __tests__/components/GroupCard.test.tsx --watchman=false
```

Expected: all green.

- [ ] Re-run the SQL test against dev via `mcp__supabase__execute_sql` and expect the `All activity_group_last_seen tests passed.` notice.
- [ ] Confirm no visual regression on the Activity tab badge (same colors/size/position).
- [ ] After user approval only: apply the migration to prod (`mcp__supabase-prod__apply_migration`) and re-run the SQL test against prod.

## Open questions / risks

- **`profiles.activity_last_seen_at` non-null:** It is `NOT NULL DEFAULT NOW()` (migration `20260526105507_activity_events.sql` line 28), so `COALESCE(gls.seen_at, p.activity_last_seen_at)` can never be NULL. Safe.
- **RLS on the counts RPC:** `get_group_unread_counts()` is `SECURITY DEFINER` and filters `ae.user_id = auth.uid()`, so it never leaks other users' counts even though it bypasses table RLS. The table's own SELECT policy is defense-in-depth for any direct client read.
- **Cache invalidation timing:** `GroupDetailScreen` mark-seen runs on focus; the Groups list badge clears on the next `groupUnreadCounts` refetch (invalidated immediately). With `staleTime` 30s, a user rapidly bouncing between list and detail may briefly see a stale badge — acceptable and matches the global-badge behavior.
- **Grand-total consistency:** The global Activity-tab count and the sum of per-group counts can differ because the global count includes non-group events (`friend_request_received`, `group_id IS NULL`). This is intentional — per-group badges only sum group-scoped events.
