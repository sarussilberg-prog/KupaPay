# Canonical Simplifier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `simplifyDebts` the canonical definition of a debt. Every UI surface (group header, list chip, friend tile, breakdown sheet, settle-up screen) derives from one struct produced by one pure function in `@cost-share/shared`. Replace three pair-level RPCs with one user-level-nets RPC. Enforce the cross-surface consistency invariant with property-based tests.

**Architecture:** SQL aggregates per-`(group, currency, user)` nets only — no simplification, no pair-level math. A pure TypeScript module in `@cost-share/shared` runs `simplifyDebts` per `(group, currency)` and produces a `SimplifiedDebts` struct with views for every consumer. A single React Query hook (`useSimplifiedDebts`) on mobile feeds every UI surface from this struct.

**Tech Stack:** Supabase (Postgres + RPC), TypeScript, React Native + Expo, React Query, Zustand, Jest, `fast-check` (property tests).

**Spec:** `docs/superpowers/specs/2026-06-17-canonical-simplifier-design.md`

---

## Pre-flight

Before starting Task 1, confirm the spec's invariants are agreed and the dev DB already has the chip-stack migration applied (it stays as a stepping-stone). Verify:

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app/apps/mobile
git status            # working tree should be clean OR contain only the chip-stack work
npx tsc --noEmit      # must pass
npx jest --listTests | head -5   # jest must be runnable
```

If `npx tsc --noEmit` fails or jest is broken, fix that first — the plan assumes a green baseline.

---

## Task 1: New RPC migration (additive only)

**Files:**
- Create: `supabase/migrations/20260617190000_simplified_inputs_rpc.sql`
- Modify: `supabase/schema.sql` (append new function near existing balance RPCs around line 487)

- [ ] **Step 1: Create the migration file**

Write `supabase/migrations/20260617190000_simplified_inputs_rpc.sql` with the function below verbatim. The name `get_user_simplified_inputs` is intentional: it returns the inputs to simplification, not the result.

```sql
-- =============================================================================
-- 20260617190000_simplified_inputs_rpc.sql
--
-- Canonical-simplifier source RPC. Returns per (group, currency, user) nets for
-- every active group the caller is in. No pair-level math, no DISTINCT ON, no
-- simplifier — that all moves to TypeScript in @cost-share/shared.
--
-- See docs/superpowers/specs/2026-06-17-canonical-simplifier-design.md.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_user_simplified_inputs(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_groups JSONB;
BEGIN
    WITH user_groups AS (
        SELECT gm.group_id
        FROM group_members gm
        JOIN groups g ON g.id = gm.group_id
        WHERE gm.user_id = p_user_id
          AND gm.is_active = TRUE
          AND g.is_active = TRUE
    ),
    group_members_active AS (
        SELECT gm.group_id, gm.user_id
        FROM group_members gm
        WHERE gm.group_id IN (SELECT group_id FROM user_groups)
          AND gm.is_active = TRUE
    ),
    paid AS (
        SELECT e.group_id, e.paid_by AS user_id, e.currency, SUM(e.amount) AS amount
        FROM expenses e
        WHERE e.group_id IN (SELECT group_id FROM user_groups)
          AND e.is_deleted = FALSE
        GROUP BY e.group_id, e.paid_by, e.currency
    ),
    owed AS (
        SELECT e.group_id, es.user_id, e.currency, SUM(es.amount) AS amount
        FROM expense_splits es
        JOIN expenses e ON e.id = es.expense_id
        WHERE e.group_id IN (SELECT group_id FROM user_groups)
          AND e.is_deleted = FALSE
        GROUP BY e.group_id, es.user_id, e.currency
    ),
    settled_paid AS (
        SELECT s.group_id, s.from_user_id AS user_id, s.currency, SUM(s.amount) AS amount
        FROM settlements s
        WHERE s.group_id IN (SELECT group_id FROM user_groups)
          AND s.deleted_at IS NULL
        GROUP BY s.group_id, s.from_user_id, s.currency
    ),
    settled_received AS (
        SELECT s.group_id, s.to_user_id AS user_id, s.currency, SUM(s.amount) AS amount
        FROM settlements s
        WHERE s.group_id IN (SELECT group_id FROM user_groups)
          AND s.deleted_at IS NULL
        GROUP BY s.group_id, s.to_user_id, s.currency
    ),
    activity AS (
        SELECT group_id, currency FROM paid
        UNION SELECT group_id, currency FROM owed
        UNION SELECT group_id, currency FROM settled_paid
        UNION SELECT group_id, currency FROM settled_received
    ),
    per_group_currency_user AS (
        SELECT
            a.group_id,
            a.currency,
            gma.user_id,
            ROUND((
                COALESCE(p.amount, 0)
              - COALESCE(o.amount, 0)
              + COALESCE(sp.amount, 0)
              - COALESCE(sr.amount, 0)
            )::numeric, 2) AS net
        FROM activity a
        JOIN group_members_active gma ON gma.group_id = a.group_id
        LEFT JOIN paid p
            ON p.group_id = a.group_id AND p.currency = a.currency AND p.user_id = gma.user_id
        LEFT JOIN owed o
            ON o.group_id = a.group_id AND o.currency = a.currency AND o.user_id = gma.user_id
        LEFT JOIN settled_paid sp
            ON sp.group_id = a.group_id AND sp.currency = a.currency AND sp.user_id = gma.user_id
        LEFT JOIN settled_received sr
            ON sr.group_id = a.group_id AND sr.currency = a.currency AND sr.user_id = gma.user_id
    ),
    nonzero_currencies AS (
        -- Drop (group, currency) pairs where every member's net is <0.01 absolute.
        SELECT group_id, currency
        FROM per_group_currency_user
        GROUP BY group_id, currency
        HAVING MAX(ABS(net)) >= 0.01
    ),
    nets_by_currency AS (
        SELECT
            pcgu.group_id,
            pcgu.currency,
            jsonb_agg(
                jsonb_build_object('userId', pcgu.user_id, 'net', pcgu.net)
                ORDER BY pcgu.user_id
            ) AS nets
        FROM per_group_currency_user pcgu
        JOIN nonzero_currencies nc
            ON nc.group_id = pcgu.group_id AND nc.currency = pcgu.currency
        GROUP BY pcgu.group_id, pcgu.currency
    ),
    currencies_per_group AS (
        SELECT
            n.group_id,
            jsonb_agg(
                jsonb_build_object('currency', n.currency, 'nets', n.nets)
                ORDER BY n.currency
            ) AS currencies
        FROM nets_by_currency n
        GROUP BY n.group_id
    ),
    members_per_group AS (
        SELECT
            gma.group_id,
            jsonb_agg(
                jsonb_build_object(
                    'userId', gma.user_id,
                    'name', p.name,
                    'avatarUrl', p.avatar_url
                )
                ORDER BY p.name
            ) AS members
        FROM group_members_active gma
        JOIN profiles p ON p.id = gma.user_id
        GROUP BY gma.group_id
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'groupId', ug.group_id,
                'members', COALESCE(m.members, '[]'::jsonb),
                'currencies', COALESCE(c.currencies, '[]'::jsonb)
            )
            ORDER BY ug.group_id
        ),
        '[]'::jsonb
    )
    INTO v_groups
    FROM user_groups ug
    LEFT JOIN members_per_group m ON m.group_id = ug.group_id
    LEFT JOIN currencies_per_group c ON c.group_id = ug.group_id
    WHERE c.currencies IS NOT NULL;  -- omit groups with zero non-zero currencies

    RETURN jsonb_build_object('groups', COALESCE(v_groups, '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_simplified_inputs(UUID) TO authenticated;
```

- [ ] **Step 2: Apply to dev DB**

Use the `mcp__supabase__apply_migration` tool with `name="simplified_inputs_rpc"` and the SQL body above. Verify success with a smoke query:

```sql
SELECT jsonb_pretty(get_user_simplified_inputs('a2f5263d-dbc9-4d80-ba8f-133d2650d12e'::uuid)->'groups'->0);
```

Expected: a JSONB object with `groupId`, `members` (array of `{userId, name, avatarUrl}`), `currencies` (array of `{currency, nets}` where each `nets` is `[{userId, net}, ...]`).

- [ ] **Step 3: Update `supabase/schema.sql`**

Locate the existing `get_user_balance_summary` block (around line 487, ends ~620). Insert the new function definition immediately above it (do not modify or remove existing functions in this task — they get dropped at the end). Use the identical SQL from Step 1.

- [ ] **Step 4: Sanity-check dev parity**

Run for Avraham (`a2f5263d-…`) and compare top-level invariants:

```sql
-- Every (group, currency) must have nets summing to 0 (±0.01)
WITH payload AS (SELECT get_user_simplified_inputs('a2f5263d-dbc9-4d80-ba8f-133d2650d12e'::uuid) AS p)
SELECT g->>'groupId' AS group_id, c->>'currency' AS currency,
       ROUND(SUM((n->>'net')::numeric), 2) AS net_sum
FROM payload, jsonb_array_elements(p->'groups') g, jsonb_array_elements(g->'currencies') c, jsonb_array_elements(c->'nets') n
GROUP BY g->>'groupId', c->>'currency'
HAVING ROUND(SUM((n->>'net')::numeric), 2) <> 0;
```

Expected: zero rows. If any row, the RPC math is wrong — debug before continuing.

- [ ] **Step 5: Commit**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app
git add supabase/migrations/20260617190000_simplified_inputs_rpc.sql supabase/schema.sql
git commit -m "feat(db): add get_user_simplified_inputs RPC (canonical-simplifier source)"
```

---

## Task 2: Shared TypeScript types

**Files:**
- Modify: `packages/shared/src/types/index.ts`

- [ ] **Step 1: Add new types**

Append to `packages/shared/src/types/index.ts` just before the existing `BalanceSummaryRow` block (do NOT remove old types in this task):

```ts
// ============================================
// SIMPLIFIED DEBTS — canonical source for every balance UI
// See packages/shared/src/calculations/simplifiedDebtsModel.ts
// ============================================

/** RPC payload returned by supabase.rpc('get_user_simplified_inputs'). */
export interface SimplifiedInputsPayload {
    groups: SimplifiedInputsGroup[];
}

export interface SimplifiedInputsGroup {
    groupId: string;
    members: SimplifiedInputsMember[];
    currencies: SimplifiedInputsCurrency[];
}

export interface SimplifiedInputsMember {
    userId: string;
    name: string;
    avatarUrl: string | null;
}

export interface SimplifiedInputsCurrency {
    currency: string;
    nets: SimplifiedInputsNet[];
}

export interface SimplifiedInputsNet {
    userId: string;
    /** paid - owed + settledPaid - settledReceived for this user, this currency, this group. */
    net: number;
}

/** A single simplified transfer; output of simplifyDebts per (group, currency). */
export interface Transfer {
    groupId: string;
    currency: string;
    fromUserId: string;
    toUserId: string;
    amount: number;
}

/** Per-group rollup for the current user. Primary = currency with largest |net|. */
export interface GroupRollup {
    groupId: string;
    primary: { currency: string; net: number };
    others: { currency: string; net: number }[];
}

/** Per-friend balance for the current user, across all shared groups. */
export interface FriendBalanceSummary {
    userId: string;
    name: string;
    avatarUrl: string | null;
    isActive: boolean;  // false when profile is_active = false; populated by client from store
    sharedGroupIds: string[];
    byCurrency: { currency: string; net: number }[];
}

/** Full canonical struct — output of deriveSimplifiedDebts. Every UI surface reads from here. */
export interface SimplifiedDebts {
    /** Canonical list of all simplified transfers across all groups/currencies. */
    transfers: Transfer[];
    /** byGroupCurrency.get(groupId)?.get(currency) ⇒ Transfer[] (settle-up & breakdown sheet). */
    byGroupCurrency: Map<string, Map<string, Transfer[]>>;
    /** Transfers where currentUserId is from or to. */
    userTransfers: Transfer[];
    /** Per-group, per-current-user rollup (header + list chip). Absent ⇒ group is settled. */
    groupRollups: Map<string, GroupRollup>;
    /** Per-friend rollup (profile screen tile). Absent ⇒ no non-zero balance with that friend. */
    friendBalances: Map<string, FriendBalanceSummary>;
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app/packages/shared
npx tsc --noEmit
```

Expected: no errors. If the new types collide with existing ones, fix by renaming the existing ones in this single commit (use search across the repo to find references); they're going away in Task 19 anyway.

- [ ] **Step 3: Commit**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app
git add packages/shared/src/types/index.ts
git commit -m "feat(shared): add SimplifiedDebts + SimplifiedInputsPayload types"
```

---

## Task 3: simplifiedDebtsModel.ts core (TDD with "all settled" fixture)

**Files:**
- Create: `packages/shared/src/calculations/simplifiedDebtsModel.ts`
- Create: `packages/shared/src/calculations/__tests__/simplifiedDebtsModel.test.ts`
- Create: `packages/shared/src/calculations/__tests__/fixtures/simplifiedInputs.ts`

- [ ] **Step 1: Write the fixtures file**

Create `packages/shared/src/calculations/__tests__/fixtures/simplifiedInputs.ts`. These IDs are referenced by every fixture and every test — keep them stable:

```ts
import { SimplifiedInputsPayload } from '../../../types';

export const ARI = 'u_ari';
export const BAR = 'u_bar';
export const NAVEH = 'u_naveh';
export const SARUS = 'u_sarus';

export const BLALA = 'g_blala';
export const PARIS = 'g_paris';
export const DFG = 'g_dfg';

export const member = (userId: string, name: string) => ({
    userId,
    name,
    avatarUrl: null,
});

/** 3 members, IRR is a perfect 3-way cycle (Ari→Bar→Naveh→Ari, each 7.33). */
export const cycle_blala: SimplifiedInputsPayload = {
    groups: [
        {
            groupId: BLALA,
            members: [member(ARI, 'Ari'), member(BAR, 'Bar'), member(NAVEH, 'Naveh')],
            currencies: [
                {
                    currency: 'IRR',
                    nets: [
                        { userId: ARI, net: 0 },
                        { userId: BAR, net: 0 },
                        { userId: NAVEH, net: 0 },
                    ],
                },
            ],
        },
    ],
};

/** 3 members, ILS; Sarus paid 44 split 14.66/14.68/14.66. */
export const residual_paris: SimplifiedInputsPayload = {
    groups: [
        {
            groupId: PARIS,
            members: [member(ARI, 'Ari'), member(NAVEH, 'Naveh'), member(SARUS, 'Sarus')],
            currencies: [
                {
                    currency: 'ILS',
                    nets: [
                        { userId: ARI, net: -14.68 },
                        { userId: NAVEH, net: -14.66 },
                        { userId: SARUS, net: 29.34 },
                    ],
                },
            ],
        },
    ],
};

/** All-settled group: no nonzero currencies → group absent from RPC. */
export const all_settled: SimplifiedInputsPayload = {
    groups: [],
};
```

- [ ] **Step 2: Write the failing test for "all_settled"**

Create `packages/shared/src/calculations/__tests__/simplifiedDebtsModel.test.ts`:

```ts
import { deriveSimplifiedDebts } from '../simplifiedDebtsModel';
import { all_settled, ARI } from './fixtures/simplifiedInputs';

describe('deriveSimplifiedDebts', () => {
    it('all_settled — every view is empty', () => {
        const d = deriveSimplifiedDebts(all_settled, ARI);
        expect(d.transfers).toEqual([]);
        expect(d.userTransfers).toEqual([]);
        expect(d.byGroupCurrency.size).toBe(0);
        expect(d.groupRollups.size).toBe(0);
        expect(d.friendBalances.size).toBe(0);
    });
});
```

- [ ] **Step 3: Run — expect FAIL (module not found)**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app/packages/shared
npx jest src/calculations/__tests__/simplifiedDebtsModel.test.ts
```

Expected: FAIL — "Cannot find module '../simplifiedDebtsModel'".

- [ ] **Step 4: Create the minimal model**

Create `packages/shared/src/calculations/simplifiedDebtsModel.ts`:

```ts
import {
    FriendBalanceSummary,
    GroupRollup,
    SimplifiedDebts,
    SimplifiedInputsPayload,
    Transfer,
} from '../types';
import { simplifyDebts } from './simplifyDebts';

/**
 * Derive the canonical SimplifiedDebts struct from the RPC payload.
 *
 * For every (group, currency), run simplifyDebts to produce a minimal set of
 * transfers. Concatenate, then project into views for each UI surface. Each
 * view is a pure projection of `transfers` plus `currentUserId` — never a
 * recalculation from raw nets. This is the structural guarantee that every
 * surface agrees with the settle-up screen.
 */
export function deriveSimplifiedDebts(
    payload: SimplifiedInputsPayload,
    currentUserId: string,
): SimplifiedDebts {
    const transfers: Transfer[] = [];

    for (const group of payload.groups) {
        const nameById = new Map<string, string>(
            group.members.map(m => [m.userId, m.name]),
        );
        for (const cur of group.currencies) {
            const balances = cur.nets.map(n => ({
                groupId: group.groupId,
                userId: n.userId,
                currency: cur.currency,
                totalPaid: 0,
                totalOwed: 0,
                totalSettledPaid: 0,
                totalSettledReceived: 0,
                netBalance: n.net,
            }));
            try {
                const result = simplifyDebts(balances, nameById);
                for (const d of result.debts) {
                    transfers.push({
                        groupId: group.groupId,
                        currency: d.currency,
                        fromUserId: d.fromUserId,
                        toUserId: d.toUserId,
                        amount: d.amount,
                    });
                }
            } catch {
                // UnbalancedLedgerError: skip this currency. Server math
                // should keep this empty in practice; surfacing it is a
                // follow-up.
                continue;
            }
        }
    }

    return {
        transfers,
        byGroupCurrency: buildByGroupCurrency(transfers),
        userTransfers: transfers.filter(
            t => t.fromUserId === currentUserId || t.toUserId === currentUserId,
        ),
        groupRollups: buildGroupRollups(transfers, currentUserId),
        friendBalances: buildFriendBalances(transfers, payload, currentUserId),
    };
}

function buildByGroupCurrency(
    transfers: Transfer[],
): Map<string, Map<string, Transfer[]>> {
    const out = new Map<string, Map<string, Transfer[]>>();
    for (const t of transfers) {
        let perGroup = out.get(t.groupId);
        if (!perGroup) {
            perGroup = new Map();
            out.set(t.groupId, perGroup);
        }
        const list = perGroup.get(t.currency) ?? [];
        list.push(t);
        perGroup.set(t.currency, list);
    }
    return out;
}

function buildGroupRollups(
    transfers: Transfer[],
    currentUserId: string,
): Map<string, GroupRollup> {
    // Per-(group, currency) net for currentUser = Σ amount where they receive
    // − Σ amount where they pay. Positive ⇒ owed; negative ⇒ owes.
    const netByGroupCurrency = new Map<string, Map<string, number>>();
    for (const t of transfers) {
        const sign =
            t.toUserId === currentUserId
                ? 1
                : t.fromUserId === currentUserId
                  ? -1
                  : 0;
        if (sign === 0) continue;
        let per = netByGroupCurrency.get(t.groupId);
        if (!per) {
            per = new Map();
            netByGroupCurrency.set(t.groupId, per);
        }
        per.set(t.currency, (per.get(t.currency) ?? 0) + sign * t.amount);
    }
    const rollups = new Map<string, GroupRollup>();
    netByGroupCurrency.forEach((per, groupId) => {
        const entries = [...per.entries()]
            .map(([currency, net]) => ({ currency, net: round2(net) }))
            .filter(e => Math.abs(e.net) >= 0.01);
        if (entries.length === 0) return;
        entries.sort(
            (a, b) =>
                Math.abs(b.net) - Math.abs(a.net) ||
                a.currency.localeCompare(b.currency),
        );
        const [primary, ...others] = entries;
        rollups.set(groupId, { groupId, primary, others });
    });
    return rollups;
}

function buildFriendBalances(
    transfers: Transfer[],
    payload: SimplifiedInputsPayload,
    currentUserId: string,
): Map<string, FriendBalanceSummary> {
    // Per-(friend, currency) net. Sign convention: positive ⇒ friend owes
    // current user; negative ⇒ current user owes friend.
    const netByFriendCurrency = new Map<string, Map<string, number>>();
    const sharedGroupsByFriend = new Map<string, Set<string>>();

    for (const t of transfers) {
        const involvesMe =
            t.fromUserId === currentUserId || t.toUserId === currentUserId;
        if (!involvesMe) continue;
        const friend =
            t.fromUserId === currentUserId ? t.toUserId : t.fromUserId;
        const sign = t.toUserId === currentUserId ? 1 : -1;
        let per = netByFriendCurrency.get(friend);
        if (!per) {
            per = new Map();
            netByFriendCurrency.set(friend, per);
        }
        per.set(t.currency, (per.get(t.currency) ?? 0) + sign * t.amount);
        let gs = sharedGroupsByFriend.get(friend);
        if (!gs) {
            gs = new Set();
            sharedGroupsByFriend.set(friend, gs);
        }
        gs.add(t.groupId);
    }

    // Resolve names from payload members; fall back to userId if absent.
    const profileById = new Map<
        string,
        { name: string; avatarUrl: string | null }
    >();
    for (const g of payload.groups) {
        for (const m of g.members) {
            if (!profileById.has(m.userId)) {
                profileById.set(m.userId, {
                    name: m.name,
                    avatarUrl: m.avatarUrl,
                });
            }
        }
    }

    const out = new Map<string, FriendBalanceSummary>();
    netByFriendCurrency.forEach((per, friendId) => {
        const byCurrency = [...per.entries()]
            .map(([currency, net]) => ({ currency, net: round2(net) }))
            .filter(e => Math.abs(e.net) >= 0.01)
            .sort((a, b) => a.currency.localeCompare(b.currency));
        if (byCurrency.length === 0) return;
        const profile = profileById.get(friendId) ?? {
            name: friendId,
            avatarUrl: null,
        };
        out.set(friendId, {
            userId: friendId,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
            isActive: true,
            sharedGroupIds: [...(sharedGroupsByFriend.get(friendId) ?? [])].sort(),
            byCurrency,
        });
    });
    return out;
}

function round2(n: number): number {
    return Number(n.toFixed(2));
}
```

- [ ] **Step 5: Run — expect PASS**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app/packages/shared
npx jest src/calculations/__tests__/simplifiedDebtsModel.test.ts
```

Expected: PASS (1 test).

- [ ] **Step 6: Re-export from calculations/index.ts**

Edit `packages/shared/src/calculations/index.ts` and append:

```ts
export {
    deriveSimplifiedDebts,
} from './simplifiedDebtsModel';
```

- [ ] **Step 7: Type-check + commit**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app/packages/shared
npx tsc --noEmit
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app
git add packages/shared/src/calculations/simplifiedDebtsModel.ts packages/shared/src/calculations/__tests__/simplifiedDebtsModel.test.ts packages/shared/src/calculations/__tests__/fixtures/simplifiedInputs.ts packages/shared/src/calculations/index.ts
git commit -m "feat(shared): add deriveSimplifiedDebts model with all_settled fixture"
```

---

## Task 4: Cycle fixture — Blala IRR perfect cycle

**Files:**
- Modify: `packages/shared/src/calculations/__tests__/simplifiedDebtsModel.test.ts`

- [ ] **Step 1: Add failing test**

Append to `simplifiedDebtsModel.test.ts`:

```ts
import { cycle_blala, BLALA, BAR, NAVEH } from './fixtures/simplifiedInputs';

describe('deriveSimplifiedDebts — cycle_blala', () => {
    it('a perfect 3-way cycle collapses to zero transfers', () => {
        const d = deriveSimplifiedDebts(cycle_blala, ARI);
        expect(d.transfers).toEqual([]);
    });

    it('groupRollups omits the group when all nets are zero', () => {
        const d = deriveSimplifiedDebts(cycle_blala, ARI);
        expect(d.groupRollups.get(BLALA)).toBeUndefined();
    });

    it('friendBalances omits both counterparties (no real debt)', () => {
        const d = deriveSimplifiedDebts(cycle_blala, ARI);
        expect(d.friendBalances.get(BAR)).toBeUndefined();
        expect(d.friendBalances.get(NAVEH)).toBeUndefined();
    });

    it('byGroupCurrency omits the group (no transfers in any currency)', () => {
        const d = deriveSimplifiedDebts(cycle_blala, ARI);
        expect(d.byGroupCurrency.get(BLALA)).toBeUndefined();
    });
});
```

- [ ] **Step 2: Run — should already PASS**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app/packages/shared
npx jest src/calculations/__tests__/simplifiedDebtsModel.test.ts
```

Expected: PASS (5 tests). If any fail, the Task 3 implementation has a bug; fix before continuing.

- [ ] **Step 3: Commit**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app
git add packages/shared/src/calculations/__tests__/simplifiedDebtsModel.test.ts
git commit -m "test(shared): cycle_blala fixture proves 3-way cycle collapses to zero"
```

---

## Task 5: Residual fixture — Paris ILS

**Files:**
- Modify: `packages/shared/src/calculations/__tests__/simplifiedDebtsModel.test.ts`

- [ ] **Step 1: Add failing tests**

Append:

```ts
import { residual_paris, PARIS, SARUS } from './fixtures/simplifiedInputs';

describe('deriveSimplifiedDebts — residual_paris', () => {
    // Sarus paid 44 split 14.66/14.68/14.66. From Sarus's POV he is owed 29.34
    // (= 14.68 + 14.66). Header used to show only 14.68 (the largest pair).

    it('produces two transfers, both toward Sarus', () => {
        const d = deriveSimplifiedDebts(residual_paris, SARUS);
        expect(d.transfers).toHaveLength(2);
        expect(d.transfers.every(t => t.toUserId === SARUS)).toBe(true);
    });

    it("rollups for Sarus show ILS +29.34 (not 14.68)", () => {
        const d = deriveSimplifiedDebts(residual_paris, SARUS);
        const rollup = d.groupRollups.get(PARIS);
        expect(rollup?.primary).toEqual({ currency: 'ILS', net: 29.34 });
        expect(rollup?.others).toEqual([]);
    });

    it("rollups for Ari show ILS -14.68", () => {
        const d = deriveSimplifiedDebts(residual_paris, ARI);
        const rollup = d.groupRollups.get(PARIS);
        expect(rollup?.primary).toEqual({ currency: 'ILS', net: -14.68 });
    });

    it("Sarus's friend tile shows Ari -14.68 and Naveh -14.66 (signs from Sarus's POV)", () => {
        const d = deriveSimplifiedDebts(residual_paris, SARUS);
        expect(d.friendBalances.get(ARI)?.byCurrency).toEqual([
            { currency: 'ILS', net: 14.68 },
        ]);
        expect(d.friendBalances.get(NAVEH)?.byCurrency).toEqual([
            { currency: 'ILS', net: 14.66 },
        ]);
    });
});
```

- [ ] **Step 2: Run — expect PASS**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app/packages/shared
npx jest src/calculations/__tests__/simplifiedDebtsModel.test.ts
```

Expected: PASS. If `groupRollups` for Sarus shows +14.68 instead of +29.34, the rollup builder is using max-pair logic — fix `buildGroupRollups` to sum.

- [ ] **Step 3: Commit**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app
git add packages/shared/src/calculations/__tests__/simplifiedDebtsModel.test.ts
git commit -m "test(shared): residual_paris fixture pins header rollup to sum, not max pair"
```

---

## Task 6: Multi-currency + multi-group fixtures

**Files:**
- Modify: `packages/shared/src/calculations/__tests__/fixtures/simplifiedInputs.ts`
- Modify: `packages/shared/src/calculations/__tests__/simplifiedDebtsModel.test.ts`

- [ ] **Step 1: Add `multi_currency_blala` fixture**

Append to `fixtures/simplifiedInputs.ts`:

```ts
/**
 * Blala with the new "Ba" USD 10 expense layered on top of the IRR 3-way cycle.
 * IRR cycle cancels; USD residuals survive.
 */
export const multi_currency_blala: SimplifiedInputsPayload = {
    groups: [
        {
            groupId: BLALA,
            members: [member(ARI, 'Ari'), member(BAR, 'Bar'), member(NAVEH, 'Naveh')],
            currencies: [
                {
                    currency: 'IRR',
                    nets: [
                        { userId: ARI, net: 0 },
                        { userId: BAR, net: 0 },
                        { userId: NAVEH, net: 0 },
                    ],
                },
                {
                    currency: 'USD',
                    nets: [
                        { userId: ARI, net: 6.67 },
                        { userId: BAR, net: -3.33 },
                        { userId: NAVEH, net: -3.34 },
                    ],
                },
            ],
        },
    ],
};

/** Avraham in 2 groups: residual_paris (ILS) + blala (USD). Same friend (Naveh) in both. */
export const multi_group: SimplifiedInputsPayload = {
    groups: [
        // copy of residual_paris, expressed inline
        residual_paris.groups[0],
        // copy of multi_currency_blala USD-only piece (omit IRR for cleaner assertions)
        {
            groupId: BLALA,
            members: [member(ARI, 'Ari'), member(BAR, 'Bar'), member(NAVEH, 'Naveh')],
            currencies: [
                {
                    currency: 'USD',
                    nets: [
                        { userId: ARI, net: 6.67 },
                        { userId: BAR, net: -3.33 },
                        { userId: NAVEH, net: -3.34 },
                    ],
                },
            ],
        },
    ],
};
```

- [ ] **Step 2: Add tests**

Append to `simplifiedDebtsModel.test.ts`:

```ts
import { multi_currency_blala, multi_group } from './fixtures/simplifiedInputs';

describe('deriveSimplifiedDebts — multi_currency_blala', () => {
    it('IRR cycle cancels but USD residuals produce 2 transfers', () => {
        const d = deriveSimplifiedDebts(multi_currency_blala, ARI);
        const usdTransfers = d.transfers.filter(t => t.currency === 'USD');
        const irrTransfers = d.transfers.filter(t => t.currency === 'IRR');
        expect(irrTransfers).toEqual([]);
        expect(usdTransfers).toHaveLength(2);
        expect(usdTransfers.every(t => t.toUserId === ARI)).toBe(true);
    });

    it("Ari's rollup primary is USD +6.67, no others", () => {
        const d = deriveSimplifiedDebts(multi_currency_blala, ARI);
        const rollup = d.groupRollups.get(BLALA);
        expect(rollup?.primary).toEqual({ currency: 'USD', net: 6.67 });
        expect(rollup?.others).toEqual([]);
    });

    it("Bar's friend balance with Ari = USD +3.33 (Bar's POV: Ari is owed by Bar)", () => {
        const d = deriveSimplifiedDebts(multi_currency_blala, BAR);
        expect(d.friendBalances.get(ARI)?.byCurrency).toEqual([
            { currency: 'USD', net: -3.33 },
        ]);
    });
});

describe('deriveSimplifiedDebts — multi_group', () => {
    it("sharedGroupIds collects all groups where Naveh has non-zero net with Ari", () => {
        const d = deriveSimplifiedDebts(multi_group, ARI);
        const naveh = d.friendBalances.get(NAVEH);
        expect(naveh?.sharedGroupIds.sort()).toEqual([BLALA, PARIS].sort());
    });

    it("byCurrency aggregates across groups", () => {
        const d = deriveSimplifiedDebts(multi_group, ARI);
        const naveh = d.friendBalances.get(NAVEH);
        // ILS from Paris (Naveh owes Ari 14.68? No: residual_paris had Sarus owed.
        // From Ari's POV in Paris: he owes Sarus 14.68; Naveh is uninvolved → no ILS row.
        // Naveh in Blala USD: Naveh owes Ari 3.34.
        expect(naveh?.byCurrency).toEqual([{ currency: 'USD', net: 3.34 }]);
    });
});
```

- [ ] **Step 3: Run — expect PASS**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app/packages/shared
npx jest src/calculations/__tests__/simplifiedDebtsModel.test.ts
```

Expected: all PASS. If the multi_group sharedGroupIds is missing PARIS, the iteration is restricting to user-touching transfers — that's correct for sharedGroupIds; PARIS should appear because Ari has an ILS transfer to Sarus in that group, but only if Naveh is involved in any Paris transfer involving Ari… he isn't. Re-read the assertion: `naveh?.sharedGroupIds` should be `[BLALA]` only, because Naveh has no Paris transfer with Ari. Adjust the test to:

```ts
expect(naveh?.sharedGroupIds).toEqual([BLALA]);
```

- [ ] **Step 4: Commit**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app
git add packages/shared/src/calculations/__tests__/fixtures/simplifiedInputs.ts packages/shared/src/calculations/__tests__/simplifiedDebtsModel.test.ts
git commit -m "test(shared): multi-currency + multi-group fixtures"
```

---

## Task 7: Property-based tests with fast-check

**Files:**
- Modify: `packages/shared/package.json` (add `fast-check` dev dep)
- Create: `packages/shared/src/calculations/__tests__/simplifiedDebtsModel.property.test.ts`

- [ ] **Step 1: Install fast-check**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app/packages/shared
npm install --save-dev fast-check
```

If you see a peer-dependency warning, accept it — `fast-check` is dev-only.

- [ ] **Step 2: Write property tests**

Create `packages/shared/src/calculations/__tests__/simplifiedDebtsModel.property.test.ts`:

```ts
import * as fc from 'fast-check';
import { deriveSimplifiedDebts } from '../simplifiedDebtsModel';
import {
    SimplifiedInputsPayload,
    SimplifiedInputsGroup,
} from '../../types';

const CURRENCIES = ['USD', 'EUR', 'ILS', 'IRR'];

/** Generate a balanced (group, currency) — last user absorbs rounding so Σ = 0. */
function arbCurrency(memberIds: string[]) {
    return fc.tuple(
        fc.constantFrom(...CURRENCIES),
        fc.array(
            fc.integer({ min: -10000, max: 10000 }),
            { minLength: memberIds.length, maxLength: memberIds.length },
        ),
    ).map(([currency, cents]) => {
        const total = cents.reduce((a, b) => a + b, 0);
        const adjusted = [...cents];
        adjusted[adjusted.length - 1] -= total; // force sum = 0
        return {
            currency,
            nets: memberIds.map((userId, i) => ({
                userId,
                net: adjusted[i] / 100,
            })),
        };
    });
}

function arbGroup(groupId: string, memberIds: string[]): fc.Arbitrary<SimplifiedInputsGroup> {
    return fc.array(arbCurrency(memberIds), { minLength: 0, maxLength: 3 })
        .map(currencies => ({
            groupId,
            members: memberIds.map(userId => ({
                userId,
                name: userId,
                avatarUrl: null,
            })),
            currencies: dedupeCurrencies(currencies),
        }));
}

function dedupeCurrencies<T extends { currency: string }>(arr: T[]): T[] {
    const seen = new Set<string>();
    return arr.filter(c => {
        if (seen.has(c.currency)) return false;
        seen.add(c.currency);
        return true;
    });
}

const arbPayload: fc.Arbitrary<SimplifiedInputsPayload> = fc
    .tuple(
        fc.integer({ min: 1, max: 3 }),     // group count
        fc.integer({ min: 2, max: 5 }),     // members per group
    )
    .chain(([groupCount, memberCount]) => {
        const memberIds = Array.from({ length: memberCount }, (_, i) => `u_${i}`);
        const groupIds = Array.from({ length: groupCount }, (_, i) => `g_${i}`);
        return fc
            .tuple(...groupIds.map(gid => arbGroup(gid, memberIds)))
            .map(groups => ({ groups }));
    });

describe('deriveSimplifiedDebts — invariants', () => {
    it('inv 1: rollup primary+others sum = Σ userTransfers per (group, currency) for currentUser', () => {
        fc.assert(
            fc.property(arbPayload, payload => {
                const me = 'u_0';
                const d = deriveSimplifiedDebts(payload, me);
                d.groupRollups.forEach((rollup, groupId) => {
                    const fromRollup = new Map<string, number>();
                    fromRollup.set(rollup.primary.currency, rollup.primary.net);
                    rollup.others.forEach(o =>
                        fromRollup.set(o.currency, (fromRollup.get(o.currency) ?? 0) + o.net),
                    );
                    const fromTransfers = new Map<string, number>();
                    d.userTransfers
                        .filter(t => t.groupId === groupId)
                        .forEach(t => {
                            const sign = t.toUserId === me ? 1 : -1;
                            fromTransfers.set(
                                t.currency,
                                (fromTransfers.get(t.currency) ?? 0) + sign * t.amount,
                            );
                        });
                    fromRollup.forEach((net, cur) => {
                        expect(round2(net)).toBeCloseTo(round2(fromTransfers.get(cur) ?? 0), 2);
                    });
                });
            }),
            { numRuns: 200 },
        );
    });

    it('inv 2: friendBalances.byCurrency = Σ userTransfers per (friend, currency)', () => {
        fc.assert(
            fc.property(arbPayload, payload => {
                const me = 'u_0';
                const d = deriveSimplifiedDebts(payload, me);
                d.friendBalances.forEach((friend, friendId) => {
                    const fromTransfers = new Map<string, number>();
                    d.userTransfers
                        .filter(
                            t => t.fromUserId === friendId || t.toUserId === friendId,
                        )
                        .forEach(t => {
                            const sign = t.toUserId === me ? 1 : -1;
                            fromTransfers.set(
                                t.currency,
                                (fromTransfers.get(t.currency) ?? 0) + sign * t.amount,
                            );
                        });
                    friend.byCurrency.forEach(({ currency, net }) => {
                        expect(round2(net)).toBeCloseTo(
                            round2(fromTransfers.get(currency) ?? 0),
                            2,
                        );
                    });
                });
            }),
            { numRuns: 200 },
        );
    });

    it('inv 3: every transfer.amount > 0 and from ≠ to', () => {
        fc.assert(
            fc.property(arbPayload, payload => {
                const d = deriveSimplifiedDebts(payload, 'u_0');
                d.transfers.forEach(t => {
                    expect(t.amount).toBeGreaterThan(0);
                    expect(t.fromUserId).not.toBe(t.toUserId);
                });
            }),
            { numRuns: 200 },
        );
    });

    it('inv 4: byGroupCurrency slice for (group, currency) restricted to user↔friend = friendBalances entry', () => {
        fc.assert(
            fc.property(arbPayload, payload => {
                const me = 'u_0';
                const d = deriveSimplifiedDebts(payload, me);
                d.friendBalances.forEach((friend, friendId) => {
                    const expected = new Map<string, number>();
                    friend.sharedGroupIds.forEach(gid => {
                        d.byGroupCurrency.get(gid)?.forEach((transfers, cur) => {
                            transfers
                                .filter(
                                    t =>
                                        (t.fromUserId === me && t.toUserId === friendId) ||
                                        (t.fromUserId === friendId && t.toUserId === me),
                                )
                                .forEach(t => {
                                    const sign = t.toUserId === me ? 1 : -1;
                                    expected.set(
                                        cur,
                                        (expected.get(cur) ?? 0) + sign * t.amount,
                                    );
                                });
                        });
                    });
                    friend.byCurrency.forEach(({ currency, net }) => {
                        expect(round2(net)).toBeCloseTo(
                            round2(expected.get(currency) ?? 0),
                            2,
                        );
                    });
                });
            }),
            { numRuns: 200 },
        );
    });
});

function round2(n: number): number {
    return Number(n.toFixed(2));
}
```

- [ ] **Step 3: Run — expect PASS (may take ~10s)**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app/packages/shared
npx jest src/calculations/__tests__/simplifiedDebtsModel.property.test.ts
```

Expected: 4 PASS. On counterexample, `fast-check` prints the shrunken payload — add that as a permanent fixture in `fixtures/simplifiedInputs.ts` and fix the bug.

- [ ] **Step 4: Commit**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app
git add packages/shared/package.json packages/shared/package-lock.json packages/shared/src/calculations/__tests__/simplifiedDebtsModel.property.test.ts
git commit -m "test(shared): property-based invariants for canonical simplifier"
```

---

## Task 8: Mobile — service wrapper

**Files:**
- Create: `apps/mobile/services/simplifiedDebts.service.ts`

- [ ] **Step 1: Create service**

```ts
import { SimplifiedInputsPayload } from '@cost-share/shared';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../lib/auth';

const EMPTY: SimplifiedInputsPayload = { groups: [] };

export async function fetchSimplifiedInputs(): Promise<SimplifiedInputsPayload> {
    const userId = await getCurrentUserId();
    if (!userId) return EMPTY;
    const { data, error } = await supabase.rpc('get_user_simplified_inputs', {
        p_user_id: userId,
    });
    if (error) {
        console.error('fetchSimplifiedInputs failed:', error);
        return EMPTY;
    }
    return (data as SimplifiedInputsPayload | null) ?? EMPTY;
}
```

- [ ] **Step 2: Type-check + commit**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app/apps/mobile
npx tsc --noEmit
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app
git add apps/mobile/services/simplifiedDebts.service.ts
git commit -m "feat(mobile): add fetchSimplifiedInputs service"
```

---

## Task 9: Mobile — useSimplifiedDebts hook + invalidator rename

**Files:**
- Create: `apps/mobile/hooks/useSimplifiedDebts.ts`
- Modify: `apps/mobile/hooks/queries/keys.ts` (add new key)
- Modify: `apps/mobile/lib/invalidateGroupDerivedCaches.ts` (rename → `invalidateBalanceCaches`, target new key only)
- Modify: every importer of `invalidateGroupDerivedCaches`

- [ ] **Step 1: Add query key**

In `apps/mobile/hooks/queries/keys.ts`, add:

```ts
simplifiedDebts: ['simplifiedDebts'] as const,
```

- [ ] **Step 2: Create the hook**

```ts
// apps/mobile/hooks/useSimplifiedDebts.ts
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    deriveSimplifiedDebts,
    SimplifiedDebts,
} from '@cost-share/shared';
import { fetchSimplifiedInputs } from '../services/simplifiedDebts.service';
import { useAppStore } from '../store';
import { queryKeys } from './queries/keys';

const STALE_MS = 60 * 1000;

/**
 * The one balance hook. Every UI surface that shows a debt number derives from
 * `data` returned here. Two surfaces disagreeing is a bug in deriveSimplifiedDebts,
 * not a "different RPC" mismatch.
 */
export function useSimplifiedDebts(): {
    data: SimplifiedDebts | undefined;
    isLoading: boolean;
    isError: boolean;
} {
    const currentUserId = useAppStore(s => s.currentUser?.id ?? '');
    const query = useQuery({
        queryKey: queryKeys.simplifiedDebts,
        queryFn: fetchSimplifiedInputs,
        enabled: Boolean(currentUserId),
        staleTime: STALE_MS,
    });
    const data = useMemo(() => {
        if (!query.data || !currentUserId) return undefined;
        return deriveSimplifiedDebts(query.data, currentUserId);
    }, [query.data, currentUserId]);
    return { data, isLoading: query.isLoading, isError: query.isError };
}
```

- [ ] **Step 3: Replace `invalidateGroupDerivedCaches`**

Rewrite `apps/mobile/lib/invalidateGroupDerivedCaches.ts` to:

```ts
/**
 * invalidateBalanceCaches — single source of truth for what must be refreshed
 * when an expense or settlement changes. Exactly one query key now feeds every
 * balance UI; this stays a one-line helper so callers don't drift.
 *
 * `groupId` is optional: when provided, the per-group settlement-history list
 * is also invalidated (used by SettleUpListScreen's history rows). When omitted,
 * every group's settlement history is invalidated via a predicate.
 */

import { queryClient } from './queryClient';
import { queryKeys } from '../hooks/queries/keys';

export function invalidateBalanceCaches(groupId?: string): void {
    void queryClient.invalidateQueries({ queryKey: queryKeys.simplifiedDebts });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    if (groupId) {
        void queryClient.invalidateQueries({
            queryKey: queryKeys.groupSettlements(groupId),
        });
    } else {
        // Realtime fallback when we don't have a specific groupId in scope.
        void queryClient.invalidateQueries({
            predicate: q =>
                Array.isArray(q.queryKey) && q.queryKey[0] === 'groupSettlements',
        });
    }
}
```

Callers that today pass `groupId` (every expense/settlement mutation hook does) keep passing it; realtime echo paths that don't have a specific groupId omit it.

- [ ] **Step 4: Rename file and update every importer**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app/apps/mobile
git mv lib/invalidateGroupDerivedCaches.ts lib/invalidateBalanceCaches.ts
# Then edit file: rename exported function symbol per the new code above.
```

Find and update every importer (search exact path + symbol):

```bash
grep -rn "invalidateGroupDerivedCaches" --include="*.ts" --include="*.tsx" .
```

For each match, change:

```ts
import { invalidateGroupDerivedCaches } from '../lib/invalidateGroupDerivedCaches';
// → 
import { invalidateBalanceCaches } from '../lib/invalidateBalanceCaches';
```

And replace every callsite `invalidateGroupDerivedCaches(groupId)` with `invalidateBalanceCaches(groupId)` — keep the argument so the per-group settlement-history cache is also refreshed. Realtime callbacks that don't have a groupId in scope call `invalidateBalanceCaches()` instead.

- [ ] **Step 5: Type-check + commit**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app/apps/mobile
npx tsc --noEmit
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app
git add apps/mobile/hooks/useSimplifiedDebts.ts apps/mobile/hooks/queries/keys.ts apps/mobile/lib/invalidateBalanceCaches.ts
git add -u  # picks up the rename + every callsite update
git commit -m "feat(mobile): add useSimplifiedDebts hook; rename invalidator → invalidateBalanceCaches"
```

---

## Task 10: Mobile — refactor GroupCard / BalanceChip / GroupsListScreen

**Files:**
- Modify: `apps/mobile/components/BalanceChip.tsx`
- Modify: `apps/mobile/components/GroupCard.tsx`
- Modify: `apps/mobile/screens/groups/GroupsListScreen.tsx`
- Modify: `apps/mobile/__tests__/components/BalanceChip.test.tsx`
- Modify: `apps/mobile/__tests__/components/GroupCard.test.tsx`

- [ ] **Step 1: Update BalanceChip prop**

Change its `bundle?: GroupBalanceDisplayBundle` to `rollup?: GroupRollup` (from `@cost-share/shared`). Render the primary the same way, keep the "+N" badge counting `rollup.others.length`. FX conversion (the previous `bundle` flow) is dropped from this prop — see Task 12 for how FX gets reintroduced as a per-surface display concern.

```ts
import { GroupRollup } from '@cost-share/shared';

interface BalanceChipProps {
    rollup?: GroupRollup;
    defaultCurrency: string;
}
```

Render uses `rollup.primary` and `rollup.others` directly.

- [ ] **Step 2: Update GroupCard prop**

Replace `balanceBundle?: GroupBalanceDisplayBundle` with `rollup?: GroupRollup`. Pass through.

- [ ] **Step 3: Update GroupsListScreen consumer**

Replace `useGroupBalancesDisplay(groupBalances, groups)` with reading from `useSimplifiedDebts()`:

```ts
const { data: simplified } = useSimplifiedDebts();
const balanceNetsByGroup = useMemo(() => {
    const out: Record<string, { net: number }> = {};
    simplified?.groupRollups.forEach((rollup, groupId) => {
        out[groupId] = { net: rollup.primary.net };
    });
    return out;
}, [simplified]);
```

In the FlatList renderItem, pass `rollup={simplified?.groupRollups.get(item.group.id)}` to `GroupCard`.

Remove the `useAppStore(s => s.groupBalances)` selector and any direct reads of `balanceSummary`.

- [ ] **Step 4: Update tests**

`BalanceChip.test.tsx` — replace `bundle={…}` with `rollup={…}` and use the `GroupRollup` shape directly. `GroupCard.test.tsx` — same.

- [ ] **Step 5: Run + commit**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app/apps/mobile
npx tsc --noEmit
npx jest __tests__/components/BalanceChip.test.tsx __tests__/components/GroupCard.test.tsx
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app
git add -u
git commit -m "refactor(mobile): GroupsListScreen + chip read GroupRollup from useSimplifiedDebts"
```

---

## Task 11: Mobile — refactor GroupDetailScreen + SummaryBalanceStrip

**Files:**
- Modify: `apps/mobile/components/groupDetail/SummaryBalanceStrip.tsx`
- Modify: `apps/mobile/components/groupDetail/GroupSummaryCard.tsx`
- Modify: `apps/mobile/screens/groups/GroupDetailScreen.tsx`
- Modify: `apps/mobile/__tests__/components/SummaryBalanceStrip.test.tsx`

- [ ] **Step 1: Update SummaryBalanceStrip prop**

Accept `rollup?: GroupRollup` instead of `balance: BalanceShape`. If `rollup` is undefined ⇒ render the "all settled" sentence. Otherwise render the primary sentence + chip row over `rollup.others` exactly as it does today (the chip stack + show-more logic).

- [ ] **Step 2: Update GroupSummaryCard**

Replace `balance: GroupSummaryBalance` with `rollup?: GroupRollup`. Pass through.

- [ ] **Step 3: Update GroupDetailScreen**

Replace:

```ts
const groupBalance = useAppStore(s => s.groupBalances[groupId]);
const balanceBundle = useGroupBalanceDisplay(groupBalance, displayGroup?.defaultCurrency);
const balance = useMemo(() => { ... }, ...);
```

with:

```ts
const { data: simplified } = useSimplifiedDebts();
const rollup = simplified?.groupRollups.get(groupId);
```

Pass `rollup` straight through to `GroupSummaryCard`. The settle-up count for the footer comes from the same source:

```ts
const settlementCount = simplified?.byGroupCurrency.get(groupId)
    ? [...simplified.byGroupCurrency.get(groupId)!.values()].reduce(
          (n, list) => n + list.length, 0)
    : 0;
```

Remove the `useGroupSimplifiedDebtsByCurrencyQuery` call entirely.

- [ ] **Step 4: Update tests**

`SummaryBalanceStrip.test.tsx` — replace `balance={...}` fixtures with `rollup={...}` fixtures.

- [ ] **Step 5: Run + commit**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app/apps/mobile
npx tsc --noEmit
npx jest __tests__/components/SummaryBalanceStrip.test.tsx
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app
git add -u
git commit -m "refactor(mobile): GroupDetailScreen header reads rollup from useSimplifiedDebts"
```

---

## Task 12: Mobile — FX layer (optional secondary chip)

**Files:**
- Modify: `apps/mobile/hooks/useGroupBalancesDisplay.ts` (becomes a thin FX selector)
- Modify: `apps/mobile/components/BalanceChip.tsx` (if FX display is needed)

- [ ] **Step 1: Decide FX behavior**

Read the spec section "FX". The model returns raw currencies. FX-to-default-currency for the **chip** is a display concern. If the existing `useGroupBalancesDisplay` is the FX layer, refactor it to take a `GroupRollup` and return a FX-converted `{ primary, others }` for the chip.

```ts
export function useGroupBalanceRollupDisplay(
    rollup: GroupRollup | undefined,
    defaultCurrency: string | undefined,
): GroupRollup | undefined {
    // Same logic as today's resolveGroupBalanceDisplayBundle, but input is
    // a GroupRollup and output is a GroupRollup (currencies possibly converted).
    // ...
}
```

If you decide FX is out of scope for this refactor (we ship without conversion and revisit), skip this task; the chip just shows native currency. Document the choice in the commit message.

- [ ] **Step 2: Commit**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app
git add -u
git commit -m "refactor(mobile): FX layer adapted to GroupRollup (or: deferred — see PR description)"
```

---

## Task 13: Mobile — refactor ProfileScreen friend tiles

**Files:**
- Modify: `apps/mobile/screens/profile/ProfileScreen.tsx`
- Modify: `apps/mobile/hooks/useFriendBalancesDisplay.ts`

- [ ] **Step 1: Replace friend balance source**

In ProfileScreen, replace whatever calls `useFriendBalancesDisplay` with a derivation from `useSimplifiedDebts`:

```ts
const { data: simplified } = useSimplifiedDebts();
const friends = useMemo(
    () => [...(simplified?.friendBalances.values() ?? [])]
        .sort((a, b) => a.name.localeCompare(b.name)),
    [simplified],
);
```

The "combined currencies" label needs an FX layer — apply `resolveFriendDisplayBalance` if you keep it (it already takes per-currency rows). Or drop the combined-currencies number entirely and just show the per-currency rows on the tile; visually clearer either way.

- [ ] **Step 2: Run + commit**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app/apps/mobile
npx tsc --noEmit
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app
git add -u
git commit -m "refactor(mobile): ProfileScreen friend tiles read from useSimplifiedDebts"
```

---

## Task 14: Mobile — refactor FriendGroupBalancesSheet

**Files:**
- Modify: `apps/mobile/components/dashboard/FriendGroupBalancesSheet.tsx`

- [ ] **Step 1: Replace per-group fetches with derivation from canonical**

Drop the `useQueries` over `fetchGroupPairwiseDebts`. Replace with:

```ts
const { data: simplified } = useSimplifiedDebts();
const friendId = friend?.userId ?? null;

const breakdowns: GroupBreakdown[] = useMemo(() => {
    if (!friendId || !currentUserId || !simplified) return [];
    return sharedGroupIds.map(groupId => {
        const perCurrency = simplified.byGroupCurrency.get(groupId);
        const lines: CurrencyLine[] = [];
        perCurrency?.forEach((transfers, currency) => {
            const net = transfers
                .filter(t =>
                    (t.fromUserId === currentUserId && t.toUserId === friendId) ||
                    (t.fromUserId === friendId && t.toUserId === currentUserId))
                .reduce((sum, t) => sum + (t.toUserId === currentUserId ? t.amount : -t.amount), 0);
            if (Math.abs(net) >= 0.01) {
                lines.push({ currency, netAmount: net });
            }
        });
        return { groupId, lines, isSettled: lines.length === 0, isLoading: false };
    });
}, [sharedGroupIds, simplified, friendId, currentUserId]);
```

The IRR 7.33 phantom rows for cycles disappear automatically because they don't appear in `simplified.transfers`.

- [ ] **Step 2: Run + commit**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app/apps/mobile
npx tsc --noEmit
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app
git add -u
git commit -m "refactor(mobile): FriendGroupBalancesSheet reads from canonical (cycle phantoms gone)"
```

---

## Task 15: Mobile — refactor SettleUpListScreen + BalancesScreen

**Files:**
- Modify: `apps/mobile/screens/balances/SettleUpListScreen.tsx`
- Modify: `apps/mobile/screens/balances/BalancesScreen.tsx`

- [ ] **Step 1: SettleUpListScreen**

Replace `useGroupSimplifiedDebtsByCurrencyQuery(groupId)` with:

```ts
const { data: simplified, isLoading, isError } = useSimplifiedDebts();
const debts = useMemo<PairwiseDebt[]>(() => {
    const perCurrency = simplified?.byGroupCurrency.get(groupId);
    if (!perCurrency) return [];
    const out: PairwiseDebt[] = [];
    perCurrency.forEach((transfers, currency) => {
        transfers.forEach(t => out.push({
            fromUserId: t.fromUserId,
            toUserId: t.toUserId,
            currency,
            amount: t.amount,
        }));
    });
    return out;
}, [simplified, groupId]);
```

- [ ] **Step 2: BalancesScreen**

Same pattern: replace both query calls (`useGroupSimplifiedDebtsByCurrencyQuery` and `useGroupPairwiseDebtsQuery`) with derivations from `useSimplifiedDebts`. Pairwise-debt rows (where used) come from `byGroupCurrency` flattening.

- [ ] **Step 3: Run + commit**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app/apps/mobile
npx tsc --noEmit
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app
git add -u
git commit -m "refactor(mobile): settle-up + balances screens read from canonical"
```

---

## Task 16: Mobile — CreateGroupScreen audit + cleanup

**Files:**
- Modify: `apps/mobile/screens/groups/CreateGroupScreen.tsx`

- [ ] **Step 1: Inspect**

```bash
grep -n "fetchGroupPairwiseDebts" /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app/apps/mobile/screens/groups/CreateGroupScreen.tsx
```

Read the surrounding usage. The call is likely a prefetch ("warm caches for the new group"). Replace with `void queryClient.invalidateQueries({ queryKey: queryKeys.simplifiedDebts })` or just remove the prefetch — a fresh group has no balance.

- [ ] **Step 2: Commit**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app
git add -u
git commit -m "refactor(mobile): drop pairwise-debts prefetch in CreateGroupScreen"
```

---

## Task 17: Mobile — drop old code paths

**Files:**
- Delete: `apps/mobile/hooks/queries/useGroupBalancesQueries.ts`
- Delete: `packages/shared/src/calculations/friendBalanceDisplay.ts`
- Modify: `apps/mobile/services/users.service.ts` (drop `fetchBalanceSummary`)
- Modify: `apps/mobile/services/settlements.service.ts` (drop `fetchGroupPairwiseDebts`, drop `PairwiseDebt` import if unused)
- Modify: `apps/mobile/hooks/queries/useSettlementQueries.ts` (drop `useGroupPairwiseDebtsQuery` + the legacy invalidator)
- Modify: `apps/mobile/hooks/useGroupSettlementsRealtime.ts` (drop `fetchBalanceSummary`)
- Modify: `apps/mobile/hooks/useAppRealtime.ts` (drop `fetchBalanceSummary`)
- Modify: `apps/mobile/hooks/queries/prefetchGroupsList.ts` (drop the `fetchBalanceSummary` prefetch)
- Modify: `apps/mobile/services/groups.service.ts` (drop `fetchBalanceSummary` imports + calls)
- Modify: `apps/mobile/services/dashboard.service.ts` (drop or repoint at the new hook — likely delete; ProfileScreen reads the hook directly)
- Modify: `apps/mobile/store/index.ts` (drop `balanceSummary`, `groupBalances`, setter; update consumers if any remain)
- Modify: `packages/shared/src/types/index.ts` (drop `GroupBalance`, `BalanceSummary*`, `FriendBalance*` (the old one), `UserDashboard`)
- Modify: `packages/shared/src/calculations/index.ts` (drop re-exports for deleted modules)
- Modify: `apps/mobile/hooks/useGroupBalancesDisplay.ts` (delete or repurpose for FX as in Task 12)
- Modify: `apps/mobile/hooks/useFriendBalancesDisplay.ts` (delete; ProfileScreen reads from hook directly)
- Modify: any tests referencing the deleted symbols

- [ ] **Step 1: Make the changes**

For each file above, remove the listed exports/imports. After each batch run:

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app/apps/mobile
npx tsc --noEmit
```

Fix TS errors as they surface. Do not leave dead code.

- [ ] **Step 2: Run full test suite**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app/apps/mobile
npx jest
```

Expected: every test passes. Delete tests that exercise deleted code paths.

- [ ] **Step 3: Commit**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app
git add -u
git commit -m "refactor(mobile): drop old balance code paths (single source of truth)"
```

---

## Task 18: Drop old RPCs

**Files:**
- Create: `supabase/migrations/20260617200000_drop_legacy_balance_rpcs.sql`
- Modify: `supabase/schema.sql` (delete the three function blocks)

- [ ] **Step 1: Write the drop migration**

```sql
-- 20260617200000_drop_legacy_balance_rpcs.sql
-- Supersedes get_user_balance_summary, get_user_dashboard, get_group_pairwise_debts.
-- All mobile callers now read from get_user_simplified_inputs (added 20260617190000).

DROP FUNCTION IF EXISTS public.get_user_balance_summary(uuid);
DROP FUNCTION IF EXISTS public.get_user_dashboard(uuid);
DROP FUNCTION IF EXISTS public.get_group_pairwise_debts(uuid);
```

- [ ] **Step 2: Apply to dev**

Use `mcp__supabase__apply_migration` with `name="drop_legacy_balance_rpcs"`.

Smoke check:

```sql
SELECT proname FROM pg_proc
WHERE proname IN ('get_user_balance_summary','get_user_dashboard','get_group_pairwise_debts');
```

Expected: zero rows.

- [ ] **Step 3: Update `supabase/schema.sql`**

Locate and delete the three function CREATE blocks. Keep any `GRANT EXECUTE` lines bound to those functions (they implicitly disappear with the function — but search for and remove dangling `GRANT … TO authenticated` lines).

- [ ] **Step 4: Commit**

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app
git add supabase/migrations/20260617200000_drop_legacy_balance_rpcs.sql supabase/schema.sql
git commit -m "feat(db): drop legacy balance RPCs (superseded by get_user_simplified_inputs)"
```

---

## Task 19: Apply to prod

**Files:** none

- [ ] **Step 1: Re-authenticate to prod**

Use `mcp__supabase-prod__authenticate`. If the tool is unavailable, ask the user to confirm prod auth.

- [ ] **Step 2: Apply both migrations to prod in order**

```text
mcp__supabase-prod__apply_migration
  name: "simplified_inputs_rpc"
  query: <body of 20260617190000_simplified_inputs_rpc.sql>

mcp__supabase-prod__apply_migration
  name: "drop_legacy_balance_rpcs"
  query: <body of 20260617200000_drop_legacy_balance_rpcs.sql>
```

- [ ] **Step 3: Smoke test prod**

```sql
SELECT jsonb_pretty(get_user_simplified_inputs('7dba8c85-d586-4504-8ad8-c6cfd9881c19'::uuid)->'groups'->0);
```

Check that the Blala group's IRR currency has nets that sum to zero (cycle). Check that Paris ILS has Sarus = +29.34 (and others negative).

Mobile clients won't pick up the change until the next app launch.

- [ ] **Step 4: Final commit**

If anything in the spec/plan needed amending based on what you learned, edit those docs now and commit.

```bash
cd /Users/avrahamsilberg/Desktop/projects/KupaPay/cost-share-app
git add docs/superpowers/
git commit -m "docs: reconcile canonical-simplifier spec + plan with implementation"
```

---

## Verification checklist (post-merge)

- [ ] Blala group header: green "all settled" (was: red IRR 7.33)
- [ ] Paris group header: "+ILS 29.34" (was: "+ILS 14.68")
- [ ] Friend tile for Bar (from Ari): USD +3.33, IRR row gone (was: -7.33 IRR cycle phantom)
- [ ] Per-group breakdown sheet for Blala (from Ari, friend = Bar): USD +3.33 row, no IRR row
- [ ] Settle-up screen for Blala: 2 USD transfers (Bar → Ari 3.33, Naveh → Ari 3.34), IRR settled
- [ ] All four surfaces show identical numbers for every (group, currency)
