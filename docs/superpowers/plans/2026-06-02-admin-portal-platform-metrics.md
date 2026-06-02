# Admin Portal — Platform Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show app admins how many registered users exist and how many groups are active vs archived (product archive semantics), on the existing Admin Portal hub, with an extensible metrics pipeline for future admin KPIs.

**Architecture:** One `SECURITY DEFINER` RPC `admin_get_platform_metrics()` returns a versioned JSONB document (single round-trip, same pattern as `get_user_dashboard`). Auto-archive detection is centralized in a new SQL helper `group_is_auto_archived(uuid)` extracted from the existing `get_user_groups_archive_state()` logic so admin counts cannot drift from the groups list. Mobile maps JSONB → shared `AdminPlatformMetrics` type, loads via `admin.service.ts` + React Query, renders a reusable `AdminMetricsPanel` above the existing Tools section.

**Tech Stack:** Supabase Postgres (dev `drxfbicunusmipdgbgdk`), TypeScript shared types, Expo mobile (React Query, NativeWind, i18next), Jest + RNTL, SQL regression test (`admin_portal.test.sql` extended).

**Prerequisite:** Admin portal v1 already landed (`app_admins`, `is_app_admin()`, `AdminPortalScreen`, `admin.service.ts`). See `docs/superpowers/specs/2026-06-02-admin-portal-design.md`.

**SRS (add during Task 1):** `REQ-ADMIN-01` — App admin can view platform metrics (registered users, active vs archived groups) from the admin portal; data served only via `admin_get_platform_metrics()` gated by `is_app_admin()`.

---

## Definitions (product — Hebrew UX must match this)

| Metric (UI) | Hebrew label (suggested) | SQL meaning |
|-------------|--------------------------|-------------|
| **Registered users** | משתמשים רשומים | `COUNT(*) FROM profiles WHERE is_active = TRUE` |
| **Active groups** | קבוצות פעילות | `groups.is_active = TRUE` AND **not** Type-1 auto-archived |
| **Archived groups** | קבוצות בארכיון | `groups.is_active = TRUE` AND Type-1 auto-archived |

**Type-1 auto-archive** (group-wide, from `docs/archive-mechanism-plan.md` and `group-archive.sql`):

- `groups.last_activity_at < NOW() - INTERVAL '2 months'`
- Every **active** `group_members` row has net balance `< 0.01` in every currency the group uses (same balance math as `get_user_groups_archive_state()`).

**Explicitly not in v1 UI counts:**

- **Deleted groups** (`groups.is_active = FALSE`) — terminal delete, not archive. Exposed in JSON as `groups.deleted` for future admin screens, not shown in the three headline tiles.
- **Manual archive (Type 2)** — per-user rows in `group_user_archive`. A group can be manually archived for user A but still “active” for user B; platform totals therefore use **Type-1 only**. Optional future tile: `manualArchiveMemberships` (row count in `group_user_archive`) — already reserved in JSON schema below.

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `cost-share-app/supabase/migrations/20260602140000_admin_platform_metrics.sql` | Create | `group_is_auto_archived()`, `admin_get_platform_metrics()`, grants |
| `cost-share-app/supabase/group-archive.sql` | Modify | Refactor `get_user_groups_archive_state()` to call `group_is_auto_archived(id)` |
| `cost-share-app/supabase/schema.sql` | Modify | SSOT mirror of migration + helper |
| `cost-share-app/supabase/__tests__/admin_portal.test.sql` | Modify | Cases for metrics RPC + auto-archive helper |
| `docs/SSOT/SRS.md` | Modify | Add `REQ-ADMIN-01` row |
| `cost-share-app/packages/shared/src/types/index.ts` | Modify | `AdminPlatformMetrics`, nested metric types |
| `cost-share-app/apps/mobile/services/admin.service.ts` | Modify | `fetchAdminPlatformMetrics()` |
| `cost-share-app/apps/mobile/__tests__/services/admin.service.test.ts` | Modify | RPC mapping tests |
| `cost-share-app/apps/mobile/hooks/queries/keys.ts` | Modify | `adminPlatformMetrics` key |
| `cost-share-app/apps/mobile/hooks/queries/useAdminPlatformMetricsQuery.ts` | Create | React Query hook |
| `cost-share-app/apps/mobile/components/admin/AdminMetricsPanel.tsx` | Create | Loading / error / stat row UI |
| `cost-share-app/apps/mobile/__tests__/components/admin/AdminMetricsPanel.test.tsx` | Create | Render + skeleton |
| `cost-share-app/apps/mobile/screens/admin/AdminPortalScreen.tsx` | Modify | Mount panel above Tools |
| `cost-share-app/apps/mobile/__tests__/screens/admin/AdminPortalScreen.test.tsx` | Modify | Metrics section present |
| `cost-share-app/apps/mobile/i18n/locales/en.json` | Modify | `admin.metrics.*` |
| `cost-share-app/apps/mobile/i18n/locales/he.json` | Modify | `admin.metrics.*` |

---

### Task 1: SRS traceability

**Files:**
- Modify: `docs/SSOT/SRS.md`

- [ ] **Step 1: Add requirement**

In the requirements table (new **Admin** subsection after Profile or Groups), add:

```markdown
| REQ-ADMIN-01 | ⬜ | App admin platform metrics | Admin portal shows registered user count and active vs auto-archived group counts from `admin_get_platform_metrics()`; non-admins get `not_authorized` |
```

- [ ] **Step 2: Commit**

```bash
git add docs/SSOT/SRS.md
git commit -m "docs(srs): add REQ-ADMIN-01 platform metrics"
```

---

### Task 2: SQL helper `group_is_auto_archived`

**Files:**
- Create: `cost-share-app/supabase/migrations/20260602140000_admin_platform_metrics.sql` (first section only)
- Modify: `cost-share-app/supabase/group-archive.sql`
- Modify: `cost-share-app/supabase/schema.sql`

- [ ] **Step 1: Add helper to migration file**

Create `cost-share-app/supabase/migrations/20260602140000_admin_platform_metrics.sql` with:

```sql
-- 20260602140000_admin_platform_metrics.sql
-- Platform metrics for admin portal + shared auto-archive predicate.

CREATE OR REPLACE FUNCTION public.group_is_auto_archived(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH g AS (
        SELECT id, last_activity_at
        FROM groups
        WHERE id = p_group_id AND is_active = TRUE
    ),
    members AS (
        SELECT gm.user_id
        FROM group_members gm
        WHERE gm.group_id = p_group_id AND gm.is_active = TRUE
    ),
    paid AS (
        SELECT e.paid_by AS user_id, e.currency, SUM(e.amount) AS amount
        FROM expenses e
        WHERE e.group_id = p_group_id AND e.is_deleted = FALSE
        GROUP BY e.paid_by, e.currency
    ),
    owed AS (
        SELECT es.user_id, e.currency, SUM(es.amount) AS amount
        FROM expense_splits es
        JOIN expenses e ON e.id = es.expense_id
        WHERE e.group_id = p_group_id AND e.is_deleted = FALSE
        GROUP BY es.user_id, e.currency
    ),
    settled_in AS (
        SELECT s.to_user_id AS user_id, s.currency, SUM(s.amount) AS amount
        FROM settlements s
        WHERE s.group_id = p_group_id AND s.deleted_at IS NULL
        GROUP BY s.to_user_id, s.currency
    ),
    settled_out AS (
        SELECT s.from_user_id AS user_id, s.currency, SUM(s.amount) AS amount
        FROM settlements s
        WHERE s.group_id = p_group_id AND s.deleted_at IS NULL
        GROUP BY s.from_user_id, s.currency
    ),
    currency_keys AS (
        SELECT user_id, currency FROM paid
        UNION SELECT user_id, currency FROM owed
        UNION SELECT user_id, currency FROM settled_in
        UNION SELECT user_id, currency FROM settled_out
    ),
    member_balances AS (
        SELECT ck.user_id, ck.currency,
            COALESCE(p.amount, 0) - COALESCE(o.amount, 0)
              + COALESCE(si.amount, 0) - COALESCE(so.amount, 0) AS net
        FROM currency_keys ck
        LEFT JOIN paid p ON p.user_id = ck.user_id AND p.currency = ck.currency
        LEFT JOIN owed o ON o.user_id = ck.user_id AND o.currency = ck.currency
        LEFT JOIN settled_in si ON si.user_id = ck.user_id AND si.currency = ck.currency
        LEFT JOIN settled_out so ON so.user_id = ck.user_id AND so.currency = ck.currency
        WHERE EXISTS (SELECT 1 FROM members m WHERE m.user_id = ck.user_id)
    ),
    all_settled AS (
        SELECT NOT EXISTS (
            SELECT 1 FROM member_balances mb WHERE ABS(mb.net) >= 0.01
        ) AS v
    )
    SELECT EXISTS (
        SELECT 1 FROM g
        CROSS JOIN all_settled a
        WHERE g.last_activity_at < (NOW() - INTERVAL '2 months')
          AND COALESCE(a.v, TRUE)
    );
$$;

REVOKE EXECUTE ON FUNCTION public.group_is_auto_archived(UUID) FROM PUBLIC;
-- Not granted to authenticated: only SECURITY DEFINER callers use it.
```

- [ ] **Step 2: Refactor `get_user_groups_archive_state` to use helper**

In `cost-share-app/supabase/group-archive.sql`, replace the inline `is_auto_archived` expression:

```sql
        (
            mg.last_activity_at < (NOW() - INTERVAL '2 months')
            AND COALESCE(gnb.all_settled, TRUE)
        ) AS is_auto_archived
```

with:

```sql
        public.group_is_auto_archived(mg.id) AS is_auto_archived
```

Keep the `group_no_balance` CTE only if still needed for other columns; if `is_auto_archived` was its only consumer, delete `group_no_balance` and the heavy balance CTEs from this function (they now live inside `group_is_auto_archived`). **After refactor, `get_user_groups_archive_state` should only join `my_groups` + `group_user_archive` for `is_archived_by_me`.**

- [ ] **Step 3: Mirror helper into `schema.sql`**

Append the same `CREATE OR REPLACE FUNCTION public.group_is_auto_archived` block to the admin section at the bottom of `cost-share-app/supabase/schema.sql`.

- [ ] **Step 4: Apply to dev and run SQL test (Task 6) before commit**

Run migration against dev only (`drxfbicunusmipdgbgdk`). Do **not** apply to production without explicit user approval.

- [ ] **Step 5: Commit**

```bash
git add cost-share-app/supabase/migrations/20260602140000_admin_platform_metrics.sql \
  cost-share-app/supabase/group-archive.sql \
  cost-share-app/supabase/schema.sql
git commit -m "feat(db): add group_is_auto_archived helper for admin metrics"
```

---

### Task 3: RPC `admin_get_platform_metrics`

**Files:**
- Modify: `cost-share-app/supabase/migrations/20260602140000_admin_platform_metrics.sql` (append)
- Modify: `cost-share-app/supabase/schema.sql`

- [ ] **Step 1: Append RPC to migration**

```sql
CREATE OR REPLACE FUNCTION public.admin_get_platform_metrics()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_registered_users BIGINT;
    v_deleted_users    BIGINT;
    v_active_groups    BIGINT;
    v_archived_groups  BIGINT;
    v_deleted_groups   BIGINT;
    v_manual_archive_rows BIGINT;
BEGIN
    IF NOT public.is_app_admin() THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*) INTO v_registered_users FROM profiles WHERE is_active = TRUE;
    SELECT COUNT(*) INTO v_deleted_users FROM profiles WHERE is_active = FALSE;

    SELECT COUNT(*) INTO v_active_groups
    FROM groups g
    WHERE g.is_active = TRUE AND NOT public.group_is_auto_archived(g.id);

    SELECT COUNT(*) INTO v_archived_groups
    FROM groups g
    WHERE g.is_active = TRUE AND public.group_is_auto_archived(g.id);

    SELECT COUNT(*) INTO v_deleted_groups FROM groups WHERE is_active = FALSE;
    SELECT COUNT(*) INTO v_manual_archive_rows FROM group_user_archive;

    RETURN jsonb_build_object(
        'version', 1,
        'generatedAt', NOW(),
        'users', jsonb_build_object(
            'registered', v_registered_users,
            'deleted', v_deleted_users
        ),
        'groups', jsonb_build_object(
            'active', v_active_groups,
            'archived', v_archived_groups,
            'deleted', v_deleted_groups,
            'manualArchiveMemberships', v_manual_archive_rows
        )
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_platform_metrics() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_get_platform_metrics() TO authenticated;
```

- [ ] **Step 2: Mirror into `schema.sql`**

- [ ] **Step 3: Commit**

```bash
git add cost-share-app/supabase/migrations/20260602140000_admin_platform_metrics.sql cost-share-app/supabase/schema.sql
git commit -m "feat(db): admin_get_platform_metrics RPC"
```

---

### Task 4: Shared types

**Files:**
- Modify: `cost-share-app/packages/shared/src/types/index.ts`

- [ ] **Step 1: Add types** (near other dashboard types)

```typescript
/** Platform-wide admin metrics — supabase.rpc('admin_get_platform_metrics'). */
export interface AdminPlatformMetrics {
    version: number;
    generatedAt: string; // ISO timestamp from DB
    users: {
        registered: number;
        deleted: number;
    };
    groups: {
        active: number;
        archived: number;
        deleted: number;
        manualArchiveMemberships: number;
    };
}
```

- [ ] **Step 2: Commit**

```bash
git add cost-share-app/packages/shared/src/types/index.ts
git commit -m "feat(shared): AdminPlatformMetrics type"
```

---

### Task 5: Mobile service + unit tests

**Files:**
- Modify: `cost-share-app/apps/mobile/services/admin.service.ts`
- Modify: `cost-share-app/apps/mobile/__tests__/services/admin.service.test.ts`

- [ ] **Step 1: Write failing test**

Add to `admin.service.test.ts`:

```typescript
import { fetchAdminPlatformMetrics } from '../../services/admin.service';

describe('fetchAdminPlatformMetrics', () => {
    it('maps RPC JSONB to AdminPlatformMetrics', async () => {
        mockRpc.mockResolvedValue({
            data: {
                version: 1,
                generatedAt: '2026-06-02T12:00:00Z',
                users: { registered: 10, deleted: 2 },
                groups: { active: 5, archived: 3, deleted: 1, manualArchiveMemberships: 7 },
            },
            error: null,
        });
        const m = await fetchAdminPlatformMetrics();
        expect(mockRpc).toHaveBeenCalledWith('admin_get_platform_metrics');
        expect(m).toEqual({
            version: 1,
            generatedAt: '2026-06-02T12:00:00Z',
            users: { registered: 10, deleted: 2 },
            groups: { active: 5, archived: 3, deleted: 1, manualArchiveMemberships: 7 },
        });
    });

    it('returns null on RPC error', async () => {
        mockRpc.mockResolvedValue({ data: null, error: { message: 'not_authorized' } });
        expect(await fetchAdminPlatformMetrics()).toBeNull();
    });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd cost-share-app/apps/mobile && npm test -- --testPathPattern=admin.service.test -v`  
Expected: FAIL — `fetchAdminPlatformMetrics` not exported

- [ ] **Step 3: Implement service**

```typescript
import type { AdminPlatformMetrics } from '@cost-share/shared';

type MetricsRow = {
    version: number;
    generatedAt: string;
    users: AdminPlatformMetrics['users'];
    groups: AdminPlatformMetrics['groups'];
};

export async function fetchAdminPlatformMetrics(): Promise<AdminPlatformMetrics | null> {
    const { data, error } = await supabase.rpc('admin_get_platform_metrics');
    if (error || !data) {
        if (error) console.warn('fetchAdminPlatformMetrics: RPC failed', error);
        return null;
    }
    const r = data as MetricsRow;
    return {
        version: r.version,
        generatedAt: r.generatedAt,
        users: {
            registered: Number(r.users?.registered ?? 0),
            deleted: Number(r.users?.deleted ?? 0),
        },
        groups: {
            active: Number(r.groups?.active ?? 0),
            archived: Number(r.groups?.archived ?? 0),
            deleted: Number(r.groups?.deleted ?? 0),
            manualArchiveMemberships: Number(r.groups?.manualArchiveMemberships ?? 0),
        },
    };
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add cost-share-app/apps/mobile/services/admin.service.ts \
  cost-share-app/apps/mobile/__tests__/services/admin.service.test.ts
git commit -m "feat(mobile): fetchAdminPlatformMetrics service"
```

---

### Task 6: DB regression tests

**Files:**
- Modify: `cost-share-app/supabase/__tests__/admin_portal.test.sql`

- [ ] **Step 1: Extend test seed with groups**

Inside the existing `DO $outer$` block, after profile inserts, add:

```sql
    -- Groups for auto-archive metrics (use fixed UUIDs)
    INSERT INTO groups (id, name, default_currency, is_active, last_activity_at, created_by) VALUES
        ('00000000-0000-0000-0000-0000000ad010', 'Active Group', 'ILS', TRUE, NOW(), v_admin),
        ('00000000-0000-0000-0000-0000000ad011', 'Archived Group', 'ILS', TRUE, NOW() - INTERVAL '3 months', v_admin),
        ('00000000-0000-0000-0000-0000000ad012', 'Deleted Group', 'ILS', FALSE, NOW(), v_admin);
    INSERT INTO group_members (group_id, user_id, is_active) VALUES
        ('00000000-0000-0000-0000-0000000ad010', v_admin, TRUE),
        ('00000000-0000-0000-0000-0000000ad011', v_admin, TRUE),
        ('00000000-0000-0000-0000-0000000ad012', v_admin, TRUE);
```

(No expenses → zero balances → archived group qualifies on `last_activity_at` alone.)

- [ ] **Step 2: Add CASE 4 — metrics RPC**

```sql
    -- ---- CASE 4: admin_get_platform_metrics() -------------------------
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_alice::text)::text, TRUE);
    v_caught := FALSE;
    BEGIN
        PERFORM public.admin_get_platform_metrics();
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM = 'not_authorized' THEN v_caught := TRUE; END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Case 4a failed: non-admin should get not_authorized';
    END IF;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin::text)::text, TRUE);
    DECLARE
        v_metrics JSONB;
    BEGIN
        SELECT public.admin_get_platform_metrics() INTO v_metrics;
        -- registered: admin + bob active (alice deleted)
        IF (v_metrics->'users'->>'registered')::INT < 2 THEN
            RAISE EXCEPTION 'Case 4b failed: registered users count';
        END IF;
        IF (v_metrics->'groups'->>'active')::INT <> 1 THEN
            RAISE EXCEPTION 'Case 4c failed: expected 1 active group, got %', v_metrics->'groups'->>'active';
        END IF;
        IF (v_metrics->'groups'->>'archived')::INT <> 1 THEN
            RAISE EXCEPTION 'Case 4d failed: expected 1 archived group';
        END IF;
        IF (v_metrics->'groups'->>'deleted')::INT <> 1 THEN
            RAISE EXCEPTION 'Case 4e failed: expected 1 deleted group';
        END IF;
    END;
```

**Note:** Nest the `DECLARE` block correctly inside PL/pgSQL (use a sub-block or move `v_metrics` to the outer `DECLARE` section).

- [ ] **Step 3: Run test on dev**

Run the SQL file via Supabase MCP / `psql` against dev. Expected: `admin_portal.test.sql — all cases passed` then `ROLLBACK`.

- [ ] **Step 4: Commit**

```bash
git add cost-share-app/supabase/__tests__/admin_portal.test.sql
git commit -m "test(db): admin platform metrics regression cases"
```

---

### Task 7: React Query hook

**Files:**
- Modify: `cost-share-app/apps/mobile/hooks/queries/keys.ts`
- Create: `cost-share-app/apps/mobile/hooks/queries/useAdminPlatformMetricsQuery.ts`

- [ ] **Step 1: Add query key**

```typescript
adminPlatformMetrics: ['admin', 'platform-metrics'] as const,
```

- [ ] **Step 2: Create hook**

```typescript
import { useQuery } from '@tanstack/react-query';
import { fetchAdminPlatformMetrics } from '../../services/admin.service';
import { queryKeys } from './keys';

export const ADMIN_METRICS_STALE_MS = 60_000;

export function useAdminPlatformMetricsQuery() {
    return useQuery({
        queryKey: queryKeys.adminPlatformMetrics,
        queryFn: fetchAdminPlatformMetrics,
        staleTime: ADMIN_METRICS_STALE_MS,
    });
}
```

- [ ] **Step 3: Commit**

```bash
git add cost-share-app/apps/mobile/hooks/queries/keys.ts \
  cost-share-app/apps/mobile/hooks/queries/useAdminPlatformMetricsQuery.ts
git commit -m "feat(mobile): useAdminPlatformMetricsQuery hook"
```

---

### Task 8: `AdminMetricsPanel` component

**Files:**
- Create: `cost-share-app/apps/mobile/components/admin/AdminMetricsPanel.tsx`
- Create: `cost-share-app/apps/mobile/__tests__/components/admin/AdminMetricsPanel.test.tsx`

- [ ] **Step 1: Write failing component test**

```typescript
import React from 'react';
import { render } from '@testing-library/react-native';
import { AdminMetricsPanel } from '../../../components/admin/AdminMetricsPanel';

describe('AdminMetricsPanel', () => {
    it('renders three metric values', () => {
        const { getByTestId } = render(
            <AdminMetricsPanel
                metrics={{
                    version: 1,
                    generatedAt: '2026-06-02T12:00:00Z',
                    users: { registered: 42, deleted: 1 },
                    groups: { active: 10, archived: 4, deleted: 2, manualArchiveMemberships: 0 },
                }}
            />,
        );
        expect(getByTestId('admin-metric-users').props.children).toContain(42);
        expect(getByTestId('admin-metric-groups-active').props.children).toContain(10);
        expect(getByTestId('admin-metric-groups-archived').props.children).toContain(4);
    });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd cost-share-app/apps/mobile && npm test -- --testPathPattern=AdminMetricsPanel -v`

- [ ] **Step 3: Implement panel**

Reuse `StatGroup`, `StatTile`, `StatDivider` from `components/dashboard/StatTile.tsx`. Use `onPress={() => {}}` and `accessibilityRole="text"` is not on StatTile — pass a no-op `onPress` and set `accessibilityState={{ disabled: true }}` on each tile if needed.

```tsx
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AdminPlatformMetrics } from '@cost-share/shared';
import { Text } from '../AppText';
import { StatGroup, StatTile, StatDivider } from '../dashboard/StatTile';

type Props = {
    metrics: AdminPlatformMetrics | null | undefined;
    isLoading?: boolean;
    isError?: boolean;
};

export function AdminMetricsPanel({ metrics, isLoading, isError }: Props) {
    const { t } = useTranslation();
    if (isLoading) {
        return (
            <View className="py-8 items-center" testID="admin-metrics-loading">
                <ActivityIndicator />
            </View>
        );
    }
    if (isError || !metrics) {
        return (
            <View className="mx-4 mb-4 p-4 rounded-xl bg-white border border-slate-200/80">
                <Text className="text-sm text-slate-500 text-center" testID="admin-metrics-error">
                    {t('admin.metrics.loadError')}
                </Text>
            </View>
        );
    }
    return (
        <View className="mb-2" testID="admin-metrics-panel">
            <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wide mx-4 mb-2">
                {t('admin.metrics.sectionLabel')}
            </Text>
            <StatGroup>
                <StatTile
                    label={t('admin.metrics.registeredUsers')}
                    value={metrics.users.registered}
                    onPress={() => {}}
                    testID="admin-metric-users"
                />
                <StatDivider />
                <StatTile
                    label={t('admin.metrics.activeGroups')}
                    value={metrics.groups.active}
                    onPress={() => {}}
                    testID="admin-metric-groups-active"
                />
                <StatDivider />
                <StatTile
                    label={t('admin.metrics.archivedGroups')}
                    value={metrics.groups.archived}
                    onPress={() => {}}
                    testID="admin-metric-groups-archived"
                />
            </StatGroup>
            <Text className="text-xs text-slate-400 mx-4 mt-2 text-center">
                {t('admin.metrics.archiveFootnote')}
            </Text>
        </View>
    );
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add cost-share-app/apps/mobile/components/admin/AdminMetricsPanel.tsx \
  cost-share-app/apps/mobile/__tests__/components/admin/AdminMetricsPanel.test.tsx
git commit -m "feat(mobile): AdminMetricsPanel component"
```

---

### Task 9: Wire Admin Portal screen + i18n

**Files:**
- Modify: `cost-share-app/apps/mobile/screens/admin/AdminPortalScreen.tsx`
- Modify: `cost-share-app/apps/mobile/__tests__/screens/admin/AdminPortalScreen.test.tsx`
- Modify: `cost-share-app/apps/mobile/i18n/locales/en.json`
- Modify: `cost-share-app/apps/mobile/i18n/locales/he.json`

- [ ] **Step 1: Add i18n keys**

`en.json` under `admin.metrics`:

```json
"metrics": {
    "sectionLabel": "Overview",
    "registeredUsers": "Registered users",
    "activeGroups": "Active groups",
    "archivedGroups": "Archived groups",
    "archiveFootnote": "Archived = inactive 2+ months with zero balances (app-wide). Per-user manual archive is not included.",
    "loadError": "Could not load metrics. Pull to refresh or try again later."
}
```

`he.json`:

```json
"metrics": {
    "sectionLabel": "סקירה",
    "registeredUsers": "משתמשים רשומים",
    "activeGroups": "קבוצות פעילות",
    "archivedGroups": "קבוצות בארכיון",
    "archiveFootnote": "ארכיון = ללא פעילות במשך חודשיים ויתרות אפס (לכל המשתמשים). ארכיון ידני אישי לא נספר כאן.",
    "loadError": "לא ניתן לטעון נתונים. נסו שוב מאוחר יותר."
}
```

- [ ] **Step 2: Update screen**

```tsx
import { AdminMetricsPanel } from '../../components/admin/AdminMetricsPanel';
import { useAdminPlatformMetricsQuery } from '../../hooks/queries/useAdminPlatformMetricsQuery';

// inside component:
const metricsQuery = useAdminPlatformMetricsQuery();

return (
    <ScrollView
        className="flex-1 bg-slate-50"
        refreshControl={
            <RefreshControl
                refreshing={metricsQuery.isRefetching}
                onRefresh={() => void metricsQuery.refetch()}
            />
        }
    >
        <AdminMetricsPanel
            metrics={metricsQuery.data ?? null}
            isLoading={metricsQuery.isLoading}
            isError={metricsQuery.isError}
        />
        <SettingsSection title={t('admin.portal.sectionLabel')}>
            ...
        </SettingsSection>
    </ScrollView>
);
```

Add `RefreshControl` import from `react-native`.

- [ ] **Step 3: Mock hook in screen test**

```typescript
jest.mock('../../../hooks/queries/useAdminPlatformMetricsQuery', () => ({
    useAdminPlatformMetricsQuery: () => ({
        data: {
            version: 1,
            generatedAt: '2026-06-02T12:00:00Z',
            users: { registered: 1, deleted: 0 },
            groups: { active: 2, archived: 1, deleted: 0, manualArchiveMemberships: 0 },
        },
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
    }),
}));
```

Add assertion: `expect(getByTestId('admin-metrics-panel')).toBeTruthy();`

- [ ] **Step 4: Run mobile tests**

Run: `cd cost-share-app/apps/mobile && npm test -- --testPathPattern=admin -v`  
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add cost-share-app/apps/mobile/screens/admin/AdminPortalScreen.tsx \
  cost-share-app/apps/mobile/__tests__/screens/admin/AdminPortalScreen.test.tsx \
  cost-share-app/apps/mobile/i18n/locales/en.json \
  cost-share-app/apps/mobile/i18n/locales/he.json
git commit -m "feat(mobile): show platform metrics on admin portal"
```

---

### Task 10: Manual verification

- [ ] **Step 1: Log in as app admin on dev build**

Confirm Settings → Admin Portal shows three numbers that match Supabase Studio spot-check:

```sql
SELECT public.admin_get_platform_metrics();
-- (run as service_role, or impersonate admin JWT)
```

- [ ] **Step 2: Log in as non-admin**

Portal row hidden; direct navigation still shows empty metrics error (RPC unauthorized).

---

## Self-review (plan author checklist)

| Check | Result |
|-------|--------|
| Spec coverage: registered users | Task 3 `users.registered` + UI tile |
| Spec coverage: active groups (out of archive) | Task 2–3 `groups.active` + UI tile |
| Spec coverage: archived groups | Task 3 `groups.archived` + UI tile |
| Extensibility for future metrics | Versioned JSONB; `manualArchiveMemberships`, `users.deleted`, `groups.deleted` reserved |
| No placeholder steps | All code blocks are complete |
| Type consistency | `AdminPlatformMetrics` ↔ RPC JSON keys ↔ service mapper |
| Security | RPC gates on `is_app_admin()`; helper not granted to `authenticated` |
| Archive semantics aligned with product | Type-1 auto-archive only in headline tiles; footnote documents manual exclusion |

**Gap logged:** None. Optional follow-up (not in v1): admin UI tile for `manualArchiveMemberships` or deleted-group count.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-02-admin-portal-platform-metrics.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — implement in this session with executing-plans checkpoints  

Which approach do you want?
