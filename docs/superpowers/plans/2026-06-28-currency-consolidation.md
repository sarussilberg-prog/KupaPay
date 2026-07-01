# Currency Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user collapse multi-currency debts with one counterpart into a single consolidated batch by watching a rewarded ad and picking a target currency — the batch displays as one card everywhere but counts as normal settlements for balance math.

**Architecture:** A new `consolidation_batches` table groups multiple settlement records via a `consolidation_batch_id` FK on `settlements`. A shared `groupSettlementsForDisplay()` transform folds batch members into a single `DisplaySettlement` union entry. All UI surfaces that render settlements switch from raw `Settlement[]` to `DisplaySettlement[]` via a new `useDisplaySettlementsQuery` hook; the existing RPC-based balance calculations are untouched.

**Tech Stack:** React Native / Expo, Supabase (PostgreSQL + RLS), TanStack Query v5, TypeScript, NativeWind, `jest` for unit tests.

## Global Constraints

- Test runner for `packages/shared`: `cd cost-share-app && npx jest --testPathPattern packages/shared` (no dedicated script yet; use `apps/mobile` jest which resolves `@cost-share/shared` paths)
- Test runner for `apps/mobile`: `cd cost-share-app/apps/mobile && npx jest`
- All migration files live in `cost-share-app/supabase/migrations/` with timestamp prefix `YYYYMMDDHHMMSS_<name>.sql`
- Settlement soft-delete pattern: `UPDATE … SET deleted_at = NOW()` (never hard-delete)
- `consolidation_batch` soft-delete cascades to all linked settlements atomically (one RPC)
- `useRewardedAd(featureKey)` returns `{ show: () => void; earned: boolean; loading: boolean }` — already implemented, do not re-implement
- Ad flow reuse: extract `AdGateStep` from `RemindFlowSheet.tsx` into `components/remind/AdGateStep.tsx`; both Remind and Consolidate import it — no duplication
- `ConsolidateCurrencySheet` uses `CenterDialogShell` (same as `RemindFlowSheet`) and content-swaps between steps: `gate → pick-currency → confirm`
- The "Convert" button lives in `DebtRow` alongside `onRemind` via a new `onConvert` prop — appears on every involved debt row, always (single or multi-currency)
- Tapping "Convert" on any debt row operates on ALL debts between those two users in the group (the caller collects them); single-currency batches are valid (one settlement, exchangeRate = 1.0 if same currency)
- Render current user as **"You"** (capital Y) — never their name — except on profile/account screens
- No editing of consolidated settlements — delete only (whole batch)
- Exchange rates: `useExchangeRates(baseCurrency, symbols)` already exists; single-currency conversion uses rate 1.0 and skips the FX call

---

## File Map

**New files:**
- `cost-share-app/supabase/migrations/20260628120000_consolidation_batches.sql`
- `cost-share-app/packages/shared/src/calculations/groupSettlementsForDisplay.ts`
- `cost-share-app/apps/mobile/services/consolidation.service.ts`
- `cost-share-app/apps/mobile/hooks/queries/useConsolidationQueries.ts`
- `cost-share-app/apps/mobile/components/remind/AdGateStep.tsx` — extracted from RemindFlowSheet, shared by both flows
- `cost-share-app/apps/mobile/components/ConsolidationBatchRow.tsx`
- `cost-share-app/apps/mobile/components/ConsolidationBatchDetailSheet.tsx`
- `cost-share-app/apps/mobile/components/ConsolidateCurrencySheet.tsx` — lives in components/ (not screens/), uses CenterDialogShell like RemindFlowSheet
- `cost-share-app/apps/mobile/__tests__/shared/groupSettlementsForDisplay.test.ts`

**Modified files:**
- `cost-share-app/packages/shared/src/types/index.ts` — add `ConsolidationBatch`, `DisplaySettlement`
- `cost-share-app/packages/shared/src/mappers/index.ts` — add `consolidationBatchFromRow`, extend `settlementFromRow`
- `cost-share-app/packages/shared/src/index.ts` — re-export new types/functions
- `cost-share-app/apps/mobile/services/settlements.service.ts` — add `fetchConsolidationBatches`
- `cost-share-app/apps/mobile/hooks/queries/useSettlementQueries.ts` — extend invalidation to include batches
- `cost-share-app/apps/mobile/hooks/queries/keys.ts` — add `consolidationBatches` key
- `cost-share-app/apps/mobile/components/remind/RemindFlowSheet.tsx` — replace inline `AdGateStep` with import from `AdGateStep.tsx`
- `cost-share-app/apps/mobile/components/balances/DebtRow.tsx` — add `onConvert?: () => void` prop, render alongside `onRemind`
- `cost-share-app/apps/mobile/screens/balances/SettleUpListScreen.tsx` — wire `onConvert` per debt row, open `ConsolidateCurrencySheet` with all debts for that pair
- `cost-share-app/apps/mobile/screens/balances/SettlementHistoryScreen.tsx` — use `DisplaySettlement`
- `cost-share-app/apps/mobile/components/FeedItemDetailSheet.tsx` — no change needed (still receives raw Settlement for standalone items)
- `cost-share-app/apps/mobile/components/ActivityItem.tsx` — handle `consolidation_batch_added` kind
- `cost-share-app/apps/mobile/screens/activity/ActivityFeedScreen.tsx` — route `consolidation_batch_added` events

---

## Task 1: Database Migration

**Files:**
- Create: `cost-share-app/supabase/migrations/20260628120000_consolidation_batches.sql`

**Interfaces:**
- Produces: `consolidation_batches` table and new nullable columns on `settlements`

- [ ] **Step 1: Write the migration**

```sql
-- cost-share-app/supabase/migrations/20260628120000_consolidation_batches.sql

-- ============================================
-- consolidation_batches
-- Groups multiple settlement records that were created together
-- as part of a "convert all currencies" consolidation operation.
-- ============================================

CREATE TABLE consolidation_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    paid_by_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    payment_amount DECIMAL(12, 2) NOT NULL CHECK (payment_amount > 0),
    payment_currency VARCHAR(3) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_consolidation_batches_group ON consolidation_batches(group_id);
CREATE INDEX idx_consolidation_batches_paid_by ON consolidation_batches(paid_by_user_id);
CREATE INDEX idx_consolidation_batches_active ON consolidation_batches(group_id) WHERE deleted_at IS NULL;

-- Add consolidation columns to settlements
ALTER TABLE settlements
    ADD COLUMN consolidation_batch_id UUID REFERENCES consolidation_batches(id) ON DELETE SET NULL,
    ADD COLUMN exchange_rate DECIMAL(18, 8);

CREATE INDEX idx_settlements_batch ON settlements(consolidation_batch_id)
    WHERE consolidation_batch_id IS NOT NULL;

-- ============================================
-- RPC: create_consolidation_batch
-- Atomically creates the batch record + one settlement per currency.
-- Called by the mobile client; no direct table inserts by the client.
-- ============================================

CREATE OR REPLACE FUNCTION create_consolidation_batch(
    p_group_id UUID,
    p_from_user_id UUID,
    p_to_user_id UUID,
    p_payment_currency VARCHAR(3),
    p_payment_amount DECIMAL(12, 2),
    p_settlement_date DATE,
    -- JSON array: [{currency, amount, exchange_rate}]
    p_settlements JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_batch_id UUID;
    v_item JSONB;
BEGIN
    -- Insert the batch record
    INSERT INTO consolidation_batches (
        group_id, paid_by_user_id, payment_amount, payment_currency
    )
    VALUES (p_group_id, p_from_user_id, p_payment_amount, p_payment_currency)
    RETURNING id INTO v_batch_id;

    -- Insert one settlement per source currency
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_settlements)
    LOOP
        INSERT INTO settlements (
            group_id, from_user_id, to_user_id,
            amount, currency, settlement_date,
            created_by, consolidation_batch_id, exchange_rate
        )
        VALUES (
            p_group_id,
            p_from_user_id,
            p_to_user_id,
            (v_item->>'amount')::DECIMAL,
            v_item->>'currency',
            p_settlement_date,
            auth.uid(),
            v_batch_id,
            (v_item->>'exchange_rate')::DECIMAL
        );
    END LOOP;

    RETURN v_batch_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION create_consolidation_batch TO authenticated;

-- ============================================
-- RPC: delete_consolidation_batch
-- Soft-deletes the batch and all linked settlements atomically.
-- ============================================

CREATE OR REPLACE FUNCTION delete_consolidation_batch(p_batch_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify caller is a member of the group this batch belongs to
    IF NOT EXISTS (
        SELECT 1 FROM consolidation_batches cb
        JOIN group_members gm ON gm.group_id = cb.group_id
        WHERE cb.id = p_batch_id
          AND cb.deleted_at IS NULL
          AND gm.user_id = auth.uid()
          AND gm.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Not authorized or batch not found';
    END IF;

    UPDATE settlements
        SET deleted_at = NOW()
    WHERE consolidation_batch_id = p_batch_id
      AND deleted_at IS NULL;

    UPDATE consolidation_batches
        SET deleted_at = NOW()
    WHERE id = p_batch_id;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_consolidation_batch TO authenticated;

-- ============================================
-- RLS for consolidation_batches
-- ============================================

ALTER TABLE consolidation_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view active batches in their groups"
    ON consolidation_batches FOR SELECT
    USING (
        deleted_at IS NULL AND
        EXISTS (
            SELECT 1 FROM group_members
            WHERE group_id = consolidation_batches.group_id
              AND user_id = auth.uid()
              AND is_active = TRUE
        )
    );

-- Activity trigger: fire one event for the batch (not per settlement)
-- Extend the existing activity_events settlement trigger to skip
-- settlements that belong to a batch (the batch itself fires one event).

-- Suppress per-settlement events for batched settlements
CREATE OR REPLACE FUNCTION handle_settlement_activity_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_member RECORD;
BEGIN
    -- Skip if this settlement is part of a consolidation batch
    -- (the batch-level event is fired separately)
    IF NEW.consolidation_batch_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Fire existing settlement_added logic for standalone settlements
    FOR v_member IN
        SELECT user_id FROM group_members
        WHERE group_id = NEW.group_id AND is_active = TRUE
    LOOP
        INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata)
        VALUES (
            v_member.user_id,
            'settlement_added',
            NEW.group_id,
            NEW.id,
            NEW.created_by,
            jsonb_build_object(
                'from_user_id', NEW.from_user_id,
                'to_user_id', NEW.to_user_id,
                'amount', NEW.amount,
                'currency', NEW.currency
            )
        );
    END LOOP;
    RETURN NEW;
END;
$$;

-- Batch-level activity event function (called from create_consolidation_batch context)
-- We add a separate trigger on consolidation_batches INSERT.
CREATE OR REPLACE FUNCTION handle_consolidation_batch_activity_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_member RECORD;
    v_paid_by UUID;
BEGIN
    v_paid_by := NEW.paid_by_user_id;

    FOR v_member IN
        SELECT user_id FROM group_members
        WHERE group_id = NEW.group_id AND is_active = TRUE
    LOOP
        INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata)
        VALUES (
            v_member.user_id,
            'consolidation_batch_added',
            NEW.group_id,
            NEW.id,
            auth.uid(),
            jsonb_build_object(
                'paid_by_user_id', v_paid_by,
                'payment_amount', NEW.payment_amount,
                'payment_currency', NEW.payment_currency
            )
        );
    END LOOP;
    RETURN NEW;
END;
$$;

CREATE TRIGGER after_consolidation_batch_insert
    AFTER INSERT ON consolidation_batches
    FOR EACH ROW EXECUTE FUNCTION handle_consolidation_batch_activity_event();
```

> **Note:** Check whether a `handle_settlement_activity_event` trigger already exists on the `settlements` table and replace it. If the trigger is named differently, adjust. Verify with: `\d+ settlements` in psql or via Supabase dashboard.

- [ ] **Step 2: Apply the migration to dev**

```bash
cd cost-share-app
npx supabase db push
```
Expected: migration applied with no errors.

- [ ] **Step 3: Verify schema**

```bash
npx supabase db diff
```
Expected: clean diff (no pending changes).

- [ ] **Step 4: Commit**

```bash
git add cost-share-app/supabase/migrations/20260628120000_consolidation_batches.sql
git commit -m "feat(db): add consolidation_batches table, settlements columns, and RPCs"
```

---

## Task 2: Shared Types and Mapper

**Files:**
- Modify: `cost-share-app/packages/shared/src/types/index.ts`
- Modify: `cost-share-app/packages/shared/src/mappers/index.ts`

**Interfaces:**
- Produces:
  - `ConsolidationBatch` interface (exported from `@cost-share/shared`)
  - `DisplaySettlement` discriminated union (exported from `@cost-share/shared`)
  - `consolidationBatchFromRow(r: Row): ConsolidationBatch` mapper
  - `Settlement` gains optional `consolidationBatchId?: string` and `exchangeRate?: number`

- [ ] **Step 1: Add ConsolidationBatch and DisplaySettlement to types/index.ts**

Open `cost-share-app/packages/shared/src/types/index.ts` and add after the `Settlement` interface (around line 135):

```typescript
/**
 * ConsolidationBatch — groups multiple settlements created together in a
 * "convert all currencies" flow.
 * Maps to: consolidation_batches table.
 */
export interface ConsolidationBatch {
    id: string;
    groupId: string;
    paidByUserId: string;
    paymentAmount: number;
    paymentCurrency: string;
    createdAt: Date;
    deletedAt: Date | null;
}

/**
 * DisplaySettlement — presentation unit for settlement UI surfaces.
 * A 'standalone' wraps a single Settlement; a 'batch' groups all
 * Settlement records that share a consolidation_batch_id.
 * Use this type everywhere settlements are rendered. For balance
 * math, use raw Settlement[] from getAllSettlements().
 */
export type DisplaySettlement =
    | { kind: 'standalone'; settlement: Settlement }
    | { kind: 'batch'; batch: ConsolidationBatch; settlements: Settlement[] };
```

Also extend the `Settlement` interface (around line 122) to add the two new optional fields:

```typescript
export interface Settlement {
    id: string;
    groupId: string;
    fromUserId: string;
    toUserId: string;
    amount: number;
    currency: string;
    settlementDate: Date;
    paymentMethod?: PaymentMethod;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    /** Set when this settlement is part of a consolidation batch. */
    consolidationBatchId?: string;
    /** FX rate used at time of consolidation (source currency units per 1 target currency). */
    exchangeRate?: number;
}
```

Also add `consolidation_batch_added` to `ActivityEventKind` (around line 234):

```typescript
export type ActivityEventKind =
    | 'expense_added'
    | 'settlement_added'
    | 'consolidation_batch_added'
    | 'message_posted'
    | 'friend_request_received'
    | 'group_added'
    | 'group_member_joined'
    | 'group_removed'
    | 'group_created'
    | 'group_deleted'
    | 'group_note_changed';
```

- [ ] **Step 2: Add consolidationBatchFromRow to mappers/index.ts**

Open `cost-share-app/packages/shared/src/mappers/index.ts`.

Add this import at the top (after existing Settlement import):
```typescript
import {
    // …existing imports…
    ConsolidationBatch,
} from '../types';
```

Extend `settlementFromRow` (around line 135) to read the two new columns:
```typescript
export const settlementFromRow = (r: Row): Settlement => ({
    id: r.id as string,
    groupId: r.group_id as string,
    fromUserId: r.from_user_id as string,
    toUserId: r.to_user_id as string,
    amount: Number(r.amount),
    currency: r.currency as string,
    settlementDate: toDate(r.settlement_date),
    paymentMethod: (r.payment_method as Settlement['paymentMethod']) ?? undefined,
    createdBy: r.created_by as string,
    createdAt: toDate(r.created_at),
    updatedAt: r.updated_at ? toDate(r.updated_at) : toDate(r.created_at),
    deletedAt: r.deleted_at ? toDate(r.deleted_at) : null,
    consolidationBatchId: (r.consolidation_batch_id as string) ?? undefined,
    exchangeRate: r.exchange_rate != null ? Number(r.exchange_rate) : undefined,
});
```

Add the new mapper at the end of the file:
```typescript
export const consolidationBatchFromRow = (r: Row): ConsolidationBatch => ({
    id: r.id as string,
    groupId: r.group_id as string,
    paidByUserId: r.paid_by_user_id as string,
    paymentAmount: Number(r.payment_amount),
    paymentCurrency: r.payment_currency as string,
    createdAt: toDate(r.created_at),
    deletedAt: r.deleted_at ? toDate(r.deleted_at) : null,
});
```

- [ ] **Step 3: Re-export from shared barrel**

Open `cost-share-app/packages/shared/src/index.ts` (the barrel). Verify that `ConsolidationBatch`, `DisplaySettlement`, and `consolidationBatchFromRow` are exported. If the barrel uses wildcard re-exports (`export * from './types'`, `export * from './mappers'`), no change needed. Otherwise add:
```typescript
export type { ConsolidationBatch, DisplaySettlement } from './types';
export { consolidationBatchFromRow } from './mappers';
```

- [ ] **Step 4: Type-check**

```bash
cd cost-share-app/packages/shared && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add cost-share-app/packages/shared/src/types/index.ts \
        cost-share-app/packages/shared/src/mappers/index.ts \
        cost-share-app/packages/shared/src/index.ts
git commit -m "feat(types): add ConsolidationBatch, DisplaySettlement, and updated Settlement mapper"
```

---

## Task 3: groupSettlementsForDisplay Transform

**Files:**
- Create: `cost-share-app/packages/shared/src/calculations/groupSettlementsForDisplay.ts`
- Create: `cost-share-app/apps/mobile/__tests__/shared/groupSettlementsForDisplay.test.ts`

**Interfaces:**
- Consumes: `Settlement`, `ConsolidationBatch`, `DisplaySettlement` from Task 2
- Produces:
  ```typescript
  function groupSettlementsForDisplay(
      settlements: Settlement[],
      batches: ConsolidationBatch[],
  ): DisplaySettlement[]
  ```
  — exported from `@cost-share/shared`

- [ ] **Step 1: Write the failing test**

```typescript
// cost-share-app/apps/mobile/__tests__/shared/groupSettlementsForDisplay.test.ts
import {
    groupSettlementsForDisplay,
} from '@cost-share/shared/calculations/groupSettlementsForDisplay';
import type { Settlement, ConsolidationBatch } from '@cost-share/shared';

function makeSettlement(overrides: Partial<Settlement> = {}): Settlement {
    return {
        id: 'settle-1',
        groupId: 'group-1',
        fromUserId: 'user-a',
        toUserId: 'user-b',
        amount: 100,
        currency: 'ILS',
        settlementDate: new Date('2026-06-28'),
        createdBy: 'user-a',
        createdAt: new Date('2026-06-28T10:00:00Z'),
        updatedAt: new Date('2026-06-28T10:00:00Z'),
        deletedAt: null,
        ...overrides,
    };
}

function makeBatch(overrides: Partial<ConsolidationBatch> = {}): ConsolidationBatch {
    return {
        id: 'batch-1',
        groupId: 'group-1',
        paidByUserId: 'user-a',
        paymentAmount: 118.5,
        paymentCurrency: 'ILS',
        createdAt: new Date('2026-06-28T11:00:00Z'),
        deletedAt: null,
        ...overrides,
    };
}

describe('groupSettlementsForDisplay', () => {
    it('wraps a standalone settlement as kind=standalone', () => {
        const s = makeSettlement();
        const result = groupSettlementsForDisplay([s], []);
        expect(result).toHaveLength(1);
        expect(result[0].kind).toBe('standalone');
        if (result[0].kind === 'standalone') {
            expect(result[0].settlement.id).toBe('settle-1');
        }
    });

    it('groups batched settlements under their batch', () => {
        const batch = makeBatch();
        const s1 = makeSettlement({ id: 's1', consolidationBatchId: 'batch-1', currency: 'USD', amount: 5 });
        const s2 = makeSettlement({ id: 's2', consolidationBatchId: 'batch-1', currency: 'ILS', amount: 100 });
        const result = groupSettlementsForDisplay([s1, s2], [batch]);
        expect(result).toHaveLength(1);
        expect(result[0].kind).toBe('batch');
        if (result[0].kind === 'batch') {
            expect(result[0].batch.id).toBe('batch-1');
            expect(result[0].settlements).toHaveLength(2);
        }
    });

    it('handles mixed standalone and batch settlements', () => {
        const batch = makeBatch();
        const batched = makeSettlement({ id: 'b1', consolidationBatchId: 'batch-1' });
        const standalone = makeSettlement({ id: 's1' });
        const result = groupSettlementsForDisplay([batched, standalone], [batch]);
        expect(result).toHaveLength(2);
        const kinds = result.map(r => r.kind);
        expect(kinds).toContain('batch');
        expect(kinds).toContain('standalone');
    });

    it('sorts by createdAt descending (batch.createdAt vs settlement.createdAt)', () => {
        const batch = makeBatch({ createdAt: new Date('2026-06-28T12:00:00Z') });
        const batched = makeSettlement({ id: 'b1', consolidationBatchId: 'batch-1', createdAt: new Date('2026-06-28T12:00:00Z') });
        const older = makeSettlement({ id: 's1', createdAt: new Date('2026-06-27T10:00:00Z') });
        const newer = makeSettlement({ id: 's2', createdAt: new Date('2026-06-29T10:00:00Z') });
        const result = groupSettlementsForDisplay([batched, older, newer], [batch]);
        expect(result[0].kind).toBe('standalone'); // newer
        expect(result[1].kind).toBe('batch');
        expect(result[2].kind).toBe('standalone'); // older
    });

    it('ignores orphaned batch IDs (no matching batch row)', () => {
        const s = makeSettlement({ consolidationBatchId: 'ghost-batch' });
        const result = groupSettlementsForDisplay([s], []);
        // Falls back to standalone when batch row is missing
        expect(result).toHaveLength(1);
        expect(result[0].kind).toBe('standalone');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cost-share-app/apps/mobile && npx jest __tests__/shared/groupSettlementsForDisplay.test.ts
```
Expected: FAIL — `Cannot find module '@cost-share/shared/calculations/groupSettlementsForDisplay'`

- [ ] **Step 3: Implement groupSettlementsForDisplay**

```typescript
// cost-share-app/packages/shared/src/calculations/groupSettlementsForDisplay.ts
import type { Settlement, ConsolidationBatch, DisplaySettlement } from '../types';

/**
 * Folds raw settlements and batches into a DisplaySettlement[] suitable
 * for rendering. Batched settlements (those with a consolidation_batch_id)
 * are grouped under their ConsolidationBatch row and emitted as a single
 * 'batch' entry. Settlements whose batch row is missing fall back to
 * 'standalone' so orphaned rows never disappear silently.
 *
 * The output is sorted by effective date descending:
 *   - batch: batch.createdAt
 *   - standalone: settlement.createdAt
 */
export function groupSettlementsForDisplay(
    settlements: Settlement[],
    batches: ConsolidationBatch[],
): DisplaySettlement[] {
    const batchMap = new Map<string, ConsolidationBatch>(
        batches.map(b => [b.id, b]),
    );

    const batchSettlementsMap = new Map<string, Settlement[]>();
    const standalones: Settlement[] = [];

    for (const s of settlements) {
        if (s.consolidationBatchId && batchMap.has(s.consolidationBatchId)) {
            const existing = batchSettlementsMap.get(s.consolidationBatchId) ?? [];
            existing.push(s);
            batchSettlementsMap.set(s.consolidationBatchId, existing);
        } else {
            standalones.push(s);
        }
    }

    const result: DisplaySettlement[] = [
        ...standalones.map(s => ({ kind: 'standalone' as const, settlement: s })),
        ...Array.from(batchSettlementsMap.entries()).map(([batchId, batchSettlements]) => ({
            kind: 'batch' as const,
            batch: batchMap.get(batchId)!,
            settlements: batchSettlements,
        })),
    ];

    result.sort((a, b) => {
        const aTime = a.kind === 'batch'
            ? a.batch.createdAt.getTime()
            : a.settlement.createdAt.getTime();
        const bTime = b.kind === 'batch'
            ? b.batch.createdAt.getTime()
            : b.settlement.createdAt.getTime();
        return bTime - aTime;
    });

    return result;
}
```

- [ ] **Step 4: Export from shared barrel**

In `cost-share-app/packages/shared/src/index.ts`, add:
```typescript
export { groupSettlementsForDisplay } from './calculations/groupSettlementsForDisplay';
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd cost-share-app/apps/mobile && npx jest __tests__/shared/groupSettlementsForDisplay.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add cost-share-app/packages/shared/src/calculations/groupSettlementsForDisplay.ts \
        cost-share-app/packages/shared/src/index.ts \
        cost-share-app/apps/mobile/__tests__/shared/groupSettlementsForDisplay.test.ts
git commit -m "feat(shared): add groupSettlementsForDisplay transform"
```

---

## Task 4: Service Layer — Fetch and Create

**Files:**
- Modify: `cost-share-app/apps/mobile/services/settlements.service.ts`
- Create: `cost-share-app/apps/mobile/services/consolidation.service.ts`
- Modify: `cost-share-app/apps/mobile/hooks/queries/keys.ts`

**Interfaces:**
- Consumes: `consolidationBatchFromRow`, `ConsolidationBatch`, `DisplaySettlement`, `groupSettlementsForDisplay` from Tasks 2–3
- Produces:
  ```typescript
  // settlements.service.ts
  fetchConsolidationBatches(groupId: string): Promise<ConsolidationBatch[]>

  // consolidation.service.ts
  interface CreateConsolidationBatchParams {
      groupId: string;
      fromUserId: string;
      toUserId: string;
      paymentCurrency: string;
      paymentAmount: number;
      settlementDate: Date;
      settlements: Array<{ currency: string; amount: number; exchangeRate: number }>;
  }
  createConsolidationBatch(params: CreateConsolidationBatchParams): Promise<string | null>
  deleteConsolidationBatch(batchId: string): Promise<boolean>
  ```

- [ ] **Step 1: Add consolidationBatches query key**

Open `cost-share-app/apps/mobile/hooks/queries/keys.ts` and add inside `queryKeys`:
```typescript
consolidationBatches: (groupId: string) => ['consolidationBatches', groupId] as const,
```

- [ ] **Step 2: Add fetchConsolidationBatches to settlements.service.ts**

Open `cost-share-app/apps/mobile/services/settlements.service.ts`.

Add this import at the top:
```typescript
import { consolidationBatchFromRow, ConsolidationBatch } from '@cost-share/shared';
```

Add the function at the end of the file:
```typescript
export async function fetchConsolidationBatches(groupId: string): Promise<ConsolidationBatch[]> {
    try {
        const { data, error } = await supabase
            .from('consolidation_batches')
            .select('*')
            .eq('group_id', groupId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data ?? []).map(consolidationBatchFromRow);
    } catch (error) {
        handleError(error, {
            tags: { service: 'consolidation', op: 'fetchBatches' },
            extra: { groupId },
        });
        return [];
    }
}
```

- [ ] **Step 3: Create consolidation.service.ts**

```typescript
// cost-share-app/apps/mobile/services/consolidation.service.ts
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../lib/auth';
import { showSuccessToast, showErrorToast } from '../lib/appToast';
import { handleError } from '../lib/handleError';

export interface ConsolidationSettlementInput {
    currency: string;
    amount: number;
    exchangeRate: number;
}

export interface CreateConsolidationBatchParams {
    groupId: string;
    fromUserId: string;
    toUserId: string;
    paymentCurrency: string;
    paymentAmount: number;
    settlementDate: Date;
    settlements: ConsolidationSettlementInput[];
}

export async function createConsolidationBatch(
    params: CreateConsolidationBatchParams,
): Promise<string | null> {
    const userId = await getCurrentUserId();
    if (!userId) return null;

    if (params.settlements.length === 0) {
        showErrorToast('consolidation.recordError', 'consolidation.noSettlements');
        return null;
    }

    const settlementDate = params.settlementDate.toISOString().slice(0, 10);

    try {
        const { data, error } = await supabase.rpc('create_consolidation_batch', {
            p_group_id: params.groupId,
            p_from_user_id: params.fromUserId,
            p_to_user_id: params.toUserId,
            p_payment_currency: params.paymentCurrency,
            p_payment_amount: params.paymentAmount,
            p_settlement_date: settlementDate,
            p_settlements: params.settlements.map(s => ({
                currency: s.currency,
                amount: s.amount,
                exchange_rate: s.exchangeRate,
            })),
        });
        if (error) throw error;
        showSuccessToast('consolidation.toastCreated');
        return data as string;
    } catch (error) {
        handleError(error, {
            toast: { titleKey: 'consolidation.recordError', messageKey: 'common.networkError' },
            tags: { service: 'consolidation', op: 'create' },
            extra: { groupId: params.groupId, currencyCount: params.settlements.length },
        });
        return null;
    }
}

export async function deleteConsolidationBatch(batchId: string): Promise<boolean> {
    try {
        const { error } = await supabase.rpc('delete_consolidation_batch', {
            p_batch_id: batchId,
        });
        if (error) throw error;
        showSuccessToast('consolidation.toastDeleted');
        return true;
    } catch (error) {
        handleError(error, {
            toast: { titleKey: 'consolidation.deleteError', messageKey: 'common.networkError' },
            tags: { service: 'consolidation', op: 'delete' },
            extra: { batchId },
        });
        return false;
    }
}
```

- [ ] **Step 4: Type-check**

```bash
cd cost-share-app/apps/mobile && npx tsc --noEmit
```
Expected: no errors related to new files.

- [ ] **Step 5: Commit**

```bash
git add cost-share-app/apps/mobile/services/settlements.service.ts \
        cost-share-app/apps/mobile/services/consolidation.service.ts \
        cost-share-app/apps/mobile/hooks/queries/keys.ts
git commit -m "feat(services): add fetchConsolidationBatches and consolidation CRUD service"
```

---

## Task 5: React Query Hooks

**Files:**
- Modify: `cost-share-app/apps/mobile/hooks/queries/useSettlementQueries.ts`
- Create: `cost-share-app/apps/mobile/hooks/queries/useConsolidationQueries.ts`

**Interfaces:**
- Consumes: `fetchConsolidationBatches`, `createConsolidationBatch`, `deleteConsolidationBatch`, `fetchSettlements`, `groupSettlementsForDisplay`
- Produces:
  ```typescript
  useGroupConsolidationBatchesQuery(groupId: string): UseQueryResult<ConsolidationBatch[]>
  useDisplaySettlementsQuery(groupId: string): UseQueryResult<DisplaySettlement[]>
  useCreateConsolidationBatchMutation(groupId: string): UseMutationResult
  useDeleteConsolidationBatchMutation(groupId: string): UseMutationResult
  ```

- [ ] **Step 1: Create useConsolidationQueries.ts**

```typescript
// cost-share-app/apps/mobile/hooks/queries/useConsolidationQueries.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConsolidationBatch, DisplaySettlement, groupSettlementsForDisplay } from '@cost-share/shared';
import {
    createConsolidationBatch,
    deleteConsolidationBatch,
    CreateConsolidationBatchParams,
} from '../../services/consolidation.service';
import { fetchConsolidationBatches, fetchSettlements } from '../../services/settlements.service';
import { invalidateBalanceCaches } from '../../lib/invalidateBalanceCaches';
import { queryKeys } from './keys';

export function useGroupConsolidationBatchesQuery(groupId: string) {
    return useQuery<ConsolidationBatch[]>({
        queryKey: queryKeys.consolidationBatches(groupId),
        queryFn: () => fetchConsolidationBatches(groupId),
        enabled: Boolean(groupId),
    });
}

/** Combined query: settlements + batches → DisplaySettlement[]. */
export function useDisplaySettlementsQuery(groupId: string) {
    return useQuery<DisplaySettlement[]>({
        queryKey: [...queryKeys.groupSettlements(groupId), 'display'],
        queryFn: async () => {
            const [settlements, batches] = await Promise.all([
                fetchSettlements(groupId),
                fetchConsolidationBatches(groupId),
            ]);
            return groupSettlementsForDisplay(settlements, batches);
        },
        enabled: Boolean(groupId),
    });
}

function useInvalidateAfterBatchChange(groupId: string) {
    const queryClient = useQueryClient();
    return () => {
        invalidateBalanceCaches(groupId);
        void queryClient.invalidateQueries({ queryKey: queryKeys.groupSettlements(groupId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.consolidationBatches(groupId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.activity });
    };
}

export function useCreateConsolidationBatchMutation(groupId: string) {
    const invalidate = useInvalidateAfterBatchChange(groupId);
    return useMutation({
        mutationFn: (params: CreateConsolidationBatchParams) =>
            createConsolidationBatch(params),
        onSuccess: invalidate,
    });
}

export function useDeleteConsolidationBatchMutation(groupId: string) {
    const invalidate = useInvalidateAfterBatchChange(groupId);
    return useMutation({
        mutationFn: (batchId: string) => deleteConsolidationBatch(batchId),
        onSuccess: invalidate,
    });
}
```

- [ ] **Step 2: Extend invalidation in useSettlementQueries.ts**

Open `cost-share-app/apps/mobile/hooks/queries/useSettlementQueries.ts`.

In `useInvalidateAfterSettlementChange`, add invalidation of the consolidated batches cache so the display query refetches when a standalone settlement changes:
```typescript
function useInvalidateAfterSettlementChange(groupId: string) {
    const queryClient = useQueryClient();
    return () => {
        invalidateBalanceCaches(groupId);
        void queryClient.invalidateQueries({
            queryKey: queryKeys.groupContributions(groupId),
        });
        void queryClient.invalidateQueries({ queryKey: queryKeys.activity });
        // Invalidate display settlements so groupSettlementsForDisplay re-runs
        void queryClient.invalidateQueries({
            queryKey: [...queryKeys.groupSettlements(groupId), 'display'],
        });
    };
}
```

- [ ] **Step 3: Type-check**

```bash
cd cost-share-app/apps/mobile && npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add cost-share-app/apps/mobile/hooks/queries/useConsolidationQueries.ts \
        cost-share-app/apps/mobile/hooks/queries/useSettlementQueries.ts
git commit -m "feat(hooks): add useDisplaySettlementsQuery and consolidation batch mutations"
```

---

## Task 6: Extract AdGateStep and Update DebtRow

**Files:**
- Create: `cost-share-app/apps/mobile/components/remind/AdGateStep.tsx`
- Modify: `cost-share-app/apps/mobile/components/remind/RemindFlowSheet.tsx`
- Modify: `cost-share-app/apps/mobile/components/balances/DebtRow.tsx`

**Interfaces:**
- Produces:
  ```typescript
  // AdGateStep.tsx (extracted, shared by both flows)
  interface AdGateStepProps {
      active: boolean;
      featureKey: string;
      onCompleted: () => void;
  }
  export function AdGateStep(props: AdGateStepProps): JSX.Element

  // DebtRow — new prop alongside onRemind
  interface DebtRowProps {
      // …existing props…
      onRemind?: () => void;
      onConvert?: () => void;   // NEW
  }
  ```

- [ ] **Step 1: Extract AdGateStep into its own file**

Cut the `AdGateStep` function (lines 165–247 of `RemindFlowSheet.tsx`) and paste it verbatim into a new file:

```typescript
// cost-share-app/apps/mobile/components/remind/AdGateStep.tsx
import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../AppText';
import { useRewardedAd } from '../../hooks/useRewardedAd';
import { logMonetizationEvent } from '../../services/monetization.service';

interface AdGateStepProps {
    active: boolean;
    featureKey: string;
    onCompleted: () => void;
}

/**
 * Ad-gate content. Isolated so that keying it (per sheet-open) gives a fresh
 * useRewardedAd instance — a rewarded ad can only be shown once.
 * Used by both RemindFlowSheet and ConsolidateCurrencySheet.
 */
export function AdGateStep({ active, featureKey, onCompleted }: AdGateStepProps) {
    const { t } = useTranslation();
    const { show, earned, loading } = useRewardedAd(featureKey);
    const [proMessageShown, setProMessageShown] = useState(false);

    useEffect(() => {
        if (active) void logMonetizationEvent(featureKey, 'ad_gate_shown');
    }, [active, featureKey]);

    useEffect(() => {
        if (earned) onCompleted();
    }, [earned, onCompleted]);

    const handleGoPro = () => {
        void logMonetizationEvent(featureKey, 'ad_gate_pro_tapped');
        setProMessageShown(true);
    };

    if (proMessageShown) {
        return (
            <View className="px-4 pb-6 pt-2 gap-4">
                <Text className="text-gray-700 text-base text-center leading-6">
                    {t('monetization.goProWorkingOnIt')}
                </Text>
                <TouchableOpacity
                    onPress={() => show()}
                    disabled={loading}
                    activeOpacity={0.8}
                    className="bg-primary rounded-2xl py-4 items-center flex-row justify-center gap-2"
                    testID="ad-gate-pro-continue-button"
                >
                    {loading && <ActivityIndicator color="#fff" size="small" />}
                    <Text className="text-white font-semibold text-base text-center">
                        {loading ? t('monetization.loadingAd') : t('monetization.continueBtn')}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View className="px-4 pb-6 pt-2 gap-3">
            <TouchableOpacity
                onPress={() => show()}
                disabled={loading}
                activeOpacity={0.8}
                className="bg-primary rounded-2xl py-4 items-center flex-row justify-center gap-2"
                testID="ad-gate-watch-button"
            >
                {loading && <ActivityIndicator color="#fff" size="small" />}
                <Text className="text-white font-semibold text-base">
                    {loading ? t('monetization.loadingAd') : t('monetization.watchAdButton')}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={handleGoPro}
                activeOpacity={0.7}
                className="border border-gray-200 rounded-2xl py-4 flex-row items-center justify-center"
                testID="ad-gate-pro-button"
            >
                <Text className="text-gray-700 font-medium text-base text-center">
                    {t('monetization.goProButton')}
                </Text>
            </TouchableOpacity>
        </View>
    );
}
```

- [ ] **Step 2: Update RemindFlowSheet.tsx to import from the new file**

In `RemindFlowSheet.tsx`:
1. Delete the `AdGateStep` function definition (it's now in its own file)
2. Add the import:
```typescript
import { AdGateStep } from './AdGateStep';
```
Everything else in `RemindFlowSheet.tsx` stays identical — the `<AdGateStep key={openSeq} ... />` usage is unchanged.

- [ ] **Step 3: Run existing remind tests to confirm no regression**

```bash
cd cost-share-app/apps/mobile && npx jest --testPathPattern remind
```
Expected: all pass.

- [ ] **Step 4: Add onConvert to DebtRow**

Open `cost-share-app/apps/mobile/components/balances/DebtRow.tsx`.

Add `onConvert?: () => void` to `DebtRowProps` (after `onRemind`):
```typescript
interface DebtRowProps {
    debt: DebtRowDebt;
    involved: boolean;
    fromName: string;
    toName: string;
    currentUserId: string;
    fromAvatar?: string;
    toAvatar?: string;
    onPress: () => void;
    onRemind?: () => void;
    onConvert?: () => void;   // NEW
}
```

Update the function signature to destructure it:
```typescript
export function DebtRow({
    debt,
    involved,
    fromName,
    toName,
    currentUserId,
    fromAvatar,
    toAvatar,
    onPress,
    onRemind,
    onConvert,
}: DebtRowProps) {
```

Extend the action bar (the `{onRemind && ...}` block) to show both buttons side-by-side when either is present:
```typescript
{(onRemind || onConvert) && (
    <View className="flex-row justify-end px-4 pb-3 -mt-2 gap-4">
        {onConvert && (
            <TouchableOpacity
                onPress={onConvert}
                activeOpacity={0.7}
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                testID={'convert-btn-' + debt.fromUserId + '-' + debt.toUserId + '-' + debt.currency}
            >
                <Text className="text-xs font-medium text-primary">
                    {t('consolidation.convertButton')}
                </Text>
            </TouchableOpacity>
        )}
        {onRemind && (
            <TouchableOpacity
                onPress={onRemind}
                activeOpacity={0.7}
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                testID={'remind-btn-' + debt.fromUserId + '-' + debt.toUserId}
            >
                <Text className="text-xs font-medium text-primary">
                    {t('remind.sendReminderButton')}
                </Text>
            </TouchableOpacity>
        )}
    </View>
)}
```

Add `convertButton` to `en.json` under `consolidation`:
```json
"consolidation": {
  "convertButton": "Convert to one currency"
}
```
And a placeholder in `he.json`:
```json
"consolidation": {
  "convertButton": "[HE] Convert to one currency"
}
```

- [ ] **Step 5: Type-check**

```bash
cd cost-share-app/apps/mobile && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add cost-share-app/apps/mobile/components/remind/AdGateStep.tsx \
        cost-share-app/apps/mobile/components/remind/RemindFlowSheet.tsx \
        cost-share-app/apps/mobile/components/balances/DebtRow.tsx \
        cost-share-app/apps/mobile/i18n/locales/en.json \
        cost-share-app/apps/mobile/i18n/locales/he.json
git commit -m "feat(ui): extract AdGateStep, add onConvert to DebtRow"
```

---

## Task 7: ConsolidateCurrencySheet

**Files:**
- Create: `cost-share-app/apps/mobile/components/ConsolidateCurrencySheet.tsx`

**Interfaces:**
- Consumes: `AdGateStep` (Task 6), `CenterDialogShell`, `useExchangeRates`, `useCreateConsolidationBatchMutation` (Task 5), `PairwiseDebt`
- Produces:
  ```typescript
  interface ConsolidatePair {
      fromUserId: string;
      toUserId: string;
      debts: PairwiseDebt[];   // all debts between this pair in the group
  }

  interface ConsolidateCurrencySheetProps {
      visible: boolean;
      groupId: string;
      pair: ConsolidatePair | null;
      currentUserId: string;
      memberMap: Record<string, GroupMemberLite>;
      onClose: () => void;
  }
  export function ConsolidateCurrencySheet(props): JSX.Element
  ```
- Steps inside sheet: `gate → pick-currency → confirm` (content-swap, one `CenterDialogShell`, same pattern as `RemindFlowSheet`)

- [ ] **Step 1: Create ConsolidateCurrencySheet.tsx**

```typescript
// cost-share-app/apps/mobile/components/ConsolidateCurrencySheet.tsx
/**
 * ConsolidateCurrencySheet — "Convert all debts to one currency" flow.
 *
 * Mirrors RemindFlowSheet's architecture: one CenterDialogShell, content-swaps
 * between steps (gate → pick-currency → confirm). AdGateStep is shared.
 *
 * Operates on ALL debts between a pair of users in a group, regardless of how
 * many currencies. Single-currency pairs are valid (batch with one settlement,
 * exchangeRate = 1.0).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GroupMemberLite, PairwiseDebt } from '@cost-share/shared';
import { CenterDialogShell } from './CenterDialogShell';
import { Text } from './AppText';
import { AdGateStep } from './remind/AdGateStep';
import { formatAmountDecimal } from '../lib/currencyDisplay';
import { convertToBaseCurrency } from '@cost-share/shared/calculations/fxConversion';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { useCreateConsolidationBatchMutation } from '../hooks/queries/useConsolidationQueries';

type Step = 'gate' | 'pick-currency' | 'confirm';

export interface ConsolidatePair {
    fromUserId: string;
    toUserId: string;
    /** All debts between this pair in the group. May be length 1. */
    debts: PairwiseDebt[];
}

interface ConsolidateCurrencySheetProps {
    visible: boolean;
    groupId: string;
    pair: ConsolidatePair | null;
    currentUserId: string;
    memberMap: Record<string, GroupMemberLite>;
    onClose: () => void;
}

export function ConsolidateCurrencySheet({
    visible,
    groupId,
    pair,
    currentUserId,
    memberMap,
    onClose,
}: ConsolidateCurrencySheetProps) {
    const { t } = useTranslation();
    const [step, setStep] = useState<Step>('gate');
    const [targetCurrency, setTargetCurrency] = useState<string>('');
    // Bumped on each open so AdGateStep remounts with a fresh ad
    const [openSeq, setOpenSeq] = useState(0);
    const wasVisible = useRef(false);

    // Reset state every time the sheet opens
    useEffect(() => {
        if (visible && !wasVisible.current) {
            setStep('gate');
            setTargetCurrency(pair?.debts[0]?.currency ?? '');
            setOpenSeq(s => s + 1);
        }
        wasVisible.current = visible;
    }, [visible, pair]);

    const currencies = useMemo(
        () => [...new Set((pair?.debts ?? []).map(d => d.currency))],
        [pair],
    );

    // Fetch exchange rates with the first currency as base (doesn't matter which;
    // convertToBaseCurrency handles the math). Skip if only one currency.
    const { rates } = useExchangeRates(
        currencies[0] ?? 'USD',
        currencies.length > 1 ? currencies : [],
    );

    const preview = useMemo(() => {
        if (!pair || !targetCurrency) return null;
        if (currencies.length === 1) return pair.debts[0].amount;
        if (!rates) return null;
        let total = 0;
        for (const debt of pair.debts) {
            const converted = convertToBaseCurrency(debt.amount, debt.currency, targetCurrency, rates);
            if (converted === null) return null;
            total += converted;
        }
        return Number(total.toFixed(2));
    }, [pair, targetCurrency, currencies, rates]);

    const createMutation = useCreateConsolidationBatchMutation(groupId);

    const handleConfirm = useCallback(async () => {
        if (!pair || preview === null) return;
        const settlements = pair.debts.map(debt => {
            let exchangeRate = 1;
            if (debt.currency !== targetCurrency && rates) {
                // Frankfurter rates: units of symbol per 1 base. Rate from debt.currency to targetCurrency:
                const debtRate = rates[debt.currency] ?? 1;
                const targetRate = rates[targetCurrency] ?? 1;
                exchangeRate = debtRate / targetRate;
            }
            return { currency: debt.currency, amount: debt.amount, exchangeRate };
        });
        const batchId = await createMutation.mutateAsync({
            groupId,
            fromUserId: pair.fromUserId,
            toUserId: pair.toUserId,
            paymentCurrency: targetCurrency,
            paymentAmount: preview,
            settlementDate: new Date(),
            settlements,
        });
        if (batchId) onClose();
    }, [pair, preview, targetCurrency, rates, groupId, createMutation, onClose]);

    const toName =
        pair?.toUserId === currentUserId
            ? t('common.you')
            : memberMap[pair?.toUserId ?? '']?.displayName ?? t('common.unknown');

    const sheetLabel =
        step === 'pick-currency' || step === 'confirm'
            ? t('consolidation.sheetTitle')
            : t('consolidation.sheetTitle');

    const leftAction =
        step === 'confirm'
            ? { label: t('common.back'), onPress: () => setStep('pick-currency') }
            : undefined;

    const saveLabel = step === 'confirm' ? t('consolidation.confirmButton') : undefined;
    const onSave = step === 'confirm' ? handleConfirm : undefined;
    const saveDisabled =
        step === 'confirm' ? (preview === null || createMutation.isPending) : false;

    return (
        <CenterDialogShell
            visible={visible}
            label={sheetLabel}
            onClose={onClose}
            leftLabel={leftAction?.label}
            onLeftPress={leftAction?.onPress}
            saveLabel={saveLabel}
            onSave={onSave}
            saveDisabled={saveDisabled}
        >
            {step === 'gate' && (
                <AdGateStep
                    key={openSeq}
                    active={visible}
                    featureKey="currency_consolidation"
                    onCompleted={() => setStep('pick-currency')}
                />
            )}

            {step === 'pick-currency' && pair && (
                <View className="px-4 pb-6 pt-2 gap-4">
                    {/* Debts being consolidated */}
                    <View>
                        <Text className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                            {t('consolidation.debtsLabel', { name: toName })}
                        </Text>
                        <View className="bg-slate-50 rounded-2xl border border-gray-200 overflow-hidden">
                            {pair.debts.map((d, idx) => (
                                <View
                                    key={d.currency}
                                    className={`flex-row items-center px-4 py-3 ${idx < pair.debts.length - 1 ? 'border-b border-gray-100' : ''}`}
                                >
                                    <Text className="flex-1 text-sm font-semibold text-gray-700">
                                        {d.currency}
                                    </Text>
                                    <Text className="text-sm text-gray-900">
                                        {formatAmountDecimal(d.amount)}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Target currency picker */}
                    <View>
                        <Text className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                            {t('consolidation.pickTargetCurrency')}
                        </Text>
                        <View className="flex-row flex-wrap gap-2">
                            {currencies.map(c => (
                                <TouchableOpacity
                                    key={c}
                                    onPress={() => setTargetCurrency(c)}
                                    activeOpacity={0.7}
                                    className={`px-5 py-2.5 rounded-xl border ${
                                        c === targetCurrency
                                            ? 'border-primary bg-primary/10'
                                            : 'border-gray-200 bg-white'
                                    }`}
                                    testID={`consolidation-currency-${c}`}
                                >
                                    <Text
                                        className={`text-sm font-semibold ${
                                            c === targetCurrency ? 'text-primary-dark' : 'text-gray-600'
                                        }`}
                                    >
                                        {c}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Next button */}
                    <TouchableOpacity
                        onPress={() => setStep('confirm')}
                        disabled={!targetCurrency}
                        activeOpacity={0.8}
                        className="bg-primary rounded-2xl py-4 items-center"
                        testID="consolidation-next-button"
                    >
                        <Text className="text-white font-semibold text-base">
                            {t('common.next')}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {step === 'confirm' && pair && (
                <View className="px-4 pb-6 pt-2 gap-4">
                    {/* Per-currency breakdown with conversion */}
                    <View>
                        <Text className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                            {t('consolidation.breakdown', { count: pair.debts.length })}
                        </Text>
                        <View className="bg-slate-50 rounded-2xl border border-gray-200 overflow-hidden">
                            {pair.debts.map((d, idx) => {
                                const converted =
                                    d.currency === targetCurrency
                                        ? d.amount
                                        : rates
                                          ? convertToBaseCurrency(d.amount, d.currency, targetCurrency, rates)
                                          : null;
                                return (
                                    <View
                                        key={d.currency}
                                        className={`flex-row items-center px-4 py-3 ${idx < pair.debts.length - 1 ? 'border-b border-gray-100' : ''}`}
                                    >
                                        <Text className="flex-1 text-sm text-gray-700">
                                            {d.currency} {formatAmountDecimal(d.amount)}
                                        </Text>
                                        <Text className="text-sm text-gray-400">
                                            {'→ '}
                                            {converted !== null
                                                ? `${targetCurrency} ${formatAmountDecimal(converted)}`
                                                : '—'}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>

                    {/* Total preview */}
                    {preview !== null ? (
                        <View className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
                            <Text className="text-xs text-green-700 font-semibold uppercase tracking-widest mb-1">
                                {t('consolidation.totalLabel')}
                            </Text>
                            <Text className="text-xl font-bold text-green-800">
                                {targetCurrency} {formatAmountDecimal(preview)}
                            </Text>
                            <Text className="text-xs text-green-600 mt-0.5">
                                {t('consolidation.previewCaption', { to: toName })}
                            </Text>
                        </View>
                    ) : (
                        <View className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                            <Text className="text-xs text-amber-700">
                                {t('consolidation.ratesUnavailable')}
                            </Text>
                        </View>
                    )}

                    {/* Confirm */}
                    <TouchableOpacity
                        onPress={handleConfirm}
                        disabled={preview === null || createMutation.isPending}
                        activeOpacity={0.8}
                        className="bg-primary rounded-2xl py-4 items-center flex-row justify-center gap-2"
                        testID="consolidation-confirm-button"
                    >
                        {createMutation.isPending && <ActivityIndicator color="#fff" size="small" />}
                        <Text className="text-white font-semibold text-base">
                            {t('consolidation.confirmButton')}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
        </CenterDialogShell>
    );
}
```

- [ ] **Step 2: Add remaining i18n keys to en.json**

Under the `consolidation` namespace add:
```json
"consolidation": {
  "convertButton": "Convert to one currency",
  "sheetTitle": "Convert to One Currency",
  "debtsLabel": "Debts with {{name}}",
  "pickTargetCurrency": "Convert everything to",
  "breakdown": "{{count}} debt",
  "breakdown_other": "{{count}} debts",
  "totalLabel": "You'll pay",
  "previewCaption": "to {{to}} — all debts settled",
  "ratesUnavailable": "Exchange rates unavailable. Check your connection.",
  "confirmButton": "Confirm",
  "youConsolidated": "You consolidated {{count}} debts → {{amount}}",
  "youConsolidated_other": "You consolidated {{count}} debts → {{amount}}",
  "theyConsolidated": "{{name}} consolidated → {{amount}}",
  "batchLabel": "Consolidation",
  "detailHeaderLabel": "Consolidation Detail",
  "paidBy": "Paid by {{name}}",
  "recordError": "Consolidation failed",
  "deleteError": "Could not delete",
  "toastCreated": "Consolidation recorded",
  "toastDeleted": "Consolidation deleted",
  "youConsolidatedActivity": "You consolidated debts → {{amount}}",
  "theyConsolidatedActivity": "{{name}} consolidated debts → {{amount}}"
}
```

Add placeholder equivalents to `he.json` (prefix every value with `[HE] ` for easy translator identification).

- [ ] **Step 3: Type-check**

```bash
cd cost-share-app/apps/mobile && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add cost-share-app/apps/mobile/components/ConsolidateCurrencySheet.tsx \
        cost-share-app/apps/mobile/i18n/locales/en.json \
        cost-share-app/apps/mobile/i18n/locales/he.json
git commit -m "feat(ui): add ConsolidateCurrencySheet (gate → pick-currency → confirm)"
```

---

## Task 8: ConsolidationBatchRow and ConsolidationBatchDetailSheet

**Files:**
- Create: `cost-share-app/apps/mobile/components/ConsolidationBatchRow.tsx`
- Create: `cost-share-app/apps/mobile/components/ConsolidationBatchDetailSheet.tsx`

**Interfaces:**
- Consumes: `ConsolidationBatch`, `Settlement`, `GroupMemberLite` from Tasks 2 and 4
- Produces:
  ```typescript
  interface ConsolidationBatchRowProps {
      batch: ConsolidationBatch;
      settlements: Settlement[];
      currentUserId: string;
      memberMap: Record<string, GroupMemberLite>;
      onPress: () => void;
  }
  export const ConsolidationBatchRow: React.FC<ConsolidationBatchRowProps>

  interface ConsolidationBatchDetailSheetProps {
      batch: ConsolidationBatch | null;
      settlements: Settlement[];
      memberMap: Record<string, GroupMemberLite>;
      currentUserId: string;
      onClose: () => void;
      onDelete: () => void;
  }
  export function ConsolidationBatchDetailSheet(props): JSX.Element
  ```

- [ ] **Step 1: Create ConsolidationBatchRow.tsx**

```typescript
// cost-share-app/apps/mobile/components/ConsolidationBatchRow.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ConsolidationBatch, GroupMemberLite, Settlement } from '@cost-share/shared';
import { FeedRowCard } from './FeedRowCard';
import { FeedRowThumbnail } from './FeedRowThumbnail';
import { useAppLanguage } from '../hooks/useRtlLayout';
import { formatFeedDateTime } from '../lib/formatFeedDateTime';
import { formatAmountDecimal } from '../lib/currencyDisplay';
import { colors } from '../theme';

interface ConsolidationBatchRowProps {
    batch: ConsolidationBatch;
    settlements: Settlement[];
    currentUserId: string;
    memberMap: Record<string, GroupMemberLite>;
    onPress: () => void;
}

function ConsolidationBatchRowBase({
    batch,
    settlements,
    currentUserId,
    memberMap,
    onPress,
}: ConsolidationBatchRowProps) {
    const { t } = useTranslation();
    const language = useAppLanguage();
    const timestamp = formatFeedDateTime(batch.createdAt, language);

    const paidByName =
        batch.paidByUserId === currentUserId
            ? t('common.you')
            : memberMap[batch.paidByUserId]?.displayName ?? t('common.unknown');

    const title =
        batch.paidByUserId === currentUserId
            ? t('consolidation.youConsolidated', {
                  count: settlements.length,
                  amount: `${batch.paymentCurrency} ${formatAmountDecimal(batch.paymentAmount)}`,
              })
            : t('consolidation.theyConsolidated', {
                  name: paidByName,
                  count: settlements.length,
                  amount: `${batch.paymentCurrency} ${formatAmountDecimal(batch.paymentAmount)}`,
              });

    const meta = `${timestamp} · ${t('consolidation.batch', { count: settlements.length })}`;

    const thumbnail = (
        <FeedRowThumbnail
            iconName="layers-outline"
            iconColor={colors.primaryDark}
            iconBgColor={colors.primaryExtraLight}
        />
    );

    return (
        <FeedRowCard
            thumbnail={thumbnail}
            title={title}
            meta={meta}
            amount={`${batch.paymentCurrency} ${formatAmountDecimal(batch.paymentAmount)}`}
            onPress={onPress}
            testID={`consolidation-batch-${batch.id}`}
        />
    );
}

export const ConsolidationBatchRow = React.memo(ConsolidationBatchRowBase);
```

- [ ] **Step 2: Create ConsolidationBatchDetailSheet.tsx**

```typescript
// cost-share-app/apps/mobile/components/ConsolidationBatchDetailSheet.tsx
import React from 'react';
import {
    View,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ConsolidationBatch, GroupMemberLite, Settlement } from '@cost-share/shared';
import { Text } from './AppText';
import { AppIcon } from './AppIcon';
import { MemberAvatar } from './MemberAvatar';
import { DetailSheetHeader } from './DetailSheetHeader';
import { formatAmountDecimal } from '../lib/currencyDisplay';
import { useAppLanguage } from '../hooks/useRtlLayout';
import { colors } from '../theme';
import { shadows } from '../theme/shadows';

interface ConsolidationBatchDetailSheetProps {
    batch: ConsolidationBatch | null;
    settlements: Settlement[];
    memberMap: Record<string, GroupMemberLite>;
    currentUserId: string;
    onClose: () => void;
    onDelete: () => void;
}

export function ConsolidationBatchDetailSheet({
    batch,
    settlements,
    memberMap,
    currentUserId,
    onClose,
    onDelete,
}: ConsolidationBatchDetailSheetProps) {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const language = useAppLanguage();
    const visible = batch !== null;

    if (!batch) return null;

    const paidByName =
        batch.paidByUserId === currentUserId
            ? t('common.you')
            : memberMap[batch.paidByUserId]?.displayName ?? t('common.unknown');

    const heroDate = batch.createdAt.toLocaleDateString(
        language === 'he' ? 'he-IL' : 'en-US',
        { weekday: 'long', month: 'long', day: 'numeric' },
    );

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.backdrop}>
                <Pressable
                    onPress={onClose}
                    style={StyleSheet.absoluteFillObject}
                    accessibilityRole="button"
                    accessibilityLabel={t('groups.filters.close')}
                />
                <View style={[styles.sheet, shadows.lg]} testID="consolidation-batch-detail-sheet">
                    <View className="self-center w-10 h-1 rounded-full bg-gray-200 mt-2.5 mb-2" />

                    <DetailSheetHeader
                        label={t('consolidation.detailHeaderLabel')}
                        onClose={onClose}
                        onDelete={onDelete}
                    />

                    <ScrollView
                        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
                        showsVerticalScrollIndicator
                    >
                        {/* Hero card */}
                        <View className="px-4 pt-1">
                            <View
                                className="rounded-2xl overflow-hidden border"
                                style={{ height: 160, borderColor: colors.primaryExtraLight }}
                            >
                                <LinearGradient
                                    colors={[colors.primaryDark, '#1e3a5f']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={StyleSheet.absoluteFill}
                                />
                                <View
                                    className="flex-row items-center rounded-full"
                                    style={{
                                        position: 'absolute',
                                        top: 10,
                                        left: 10,
                                        backgroundColor: 'rgba(0,0,0,0.45)',
                                        paddingHorizontal: 10,
                                        paddingVertical: 4,
                                    }}
                                >
                                    <AppIcon name="layers-outline" size={12} color="#FFFFFF" />
                                    <Text className="text-white font-semibold ml-1" style={{ fontSize: 11 }}>
                                        {t('consolidation.batchLabel')}
                                    </Text>
                                </View>
                                <Text
                                    style={{
                                        position: 'absolute',
                                        top: 12,
                                        right: 14,
                                        fontSize: 11,
                                        color: 'rgba(255,255,255,0.92)',
                                    }}
                                >
                                    {heroDate}
                                </Text>
                                <View style={{ position: 'absolute', bottom: 14, left: 14, right: 14 }}>
                                    <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff' }}>
                                        {batch.paymentCurrency} {formatAmountDecimal(batch.paymentAmount)}
                                    </Text>
                                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                                        {t('consolidation.paidBy', { name: paidByName })}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Per-currency breakdown */}
                        <View className="px-4 mt-4">
                            <Text
                                className="font-semibold uppercase text-gray-400 mb-2"
                                style={{ fontSize: 11, letterSpacing: 0.6 }}
                            >
                                {t('consolidation.breakdown', { count: settlements.length })}
                            </Text>
                            <View className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                                {settlements.map((s, idx) => {
                                    const isLast = idx === settlements.length - 1;
                                    const rate = s.exchangeRate != null
                                        ? `@ ${s.exchangeRate.toFixed(4)}`
                                        : '';
                                    return (
                                        <View
                                            key={s.id}
                                            className={`flex-row items-center px-4 py-3 ${isLast ? '' : 'border-b border-slate-100'}`}
                                        >
                                            <AppIcon
                                                name="checkmark-circle"
                                                size={16}
                                                color={colors.success.DEFAULT}
                                            />
                                            <View className="flex-1 ml-3">
                                                <Text className="text-sm font-semibold text-gray-900">
                                                    {s.currency} {formatAmountDecimal(s.amount)}
                                                </Text>
                                                {rate ? (
                                                    <Text className="text-xs text-gray-400 mt-0.5">{rate}</Text>
                                                ) : null}
                                            </View>
                                            <Text className="text-sm text-gray-500">
                                                ≈ {batch.paymentCurrency} {
                                                    s.exchangeRate != null
                                                        ? formatAmountDecimal(s.amount / s.exchangeRate)
                                                        : '—'
                                                }
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: colors.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '88%',
        overflow: 'hidden',
    },
});
```

- [ ] **Step 3: Type-check**

```bash
cd cost-share-app/apps/mobile && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add cost-share-app/apps/mobile/components/ConsolidationBatchRow.tsx \
        cost-share-app/apps/mobile/components/ConsolidationBatchDetailSheet.tsx
git commit -m "feat(ui): add ConsolidationBatchRow and ConsolidationBatchDetailSheet components"
```

---

## Task 9: SettleUpListScreen — Wire onConvert and Display Settlements

**Files:**
- Modify: `cost-share-app/apps/mobile/screens/balances/SettleUpListScreen.tsx`

**Interfaces:**
- Consumes: `useDisplaySettlementsQuery`, `useDeleteConsolidationBatchMutation`, `ConsolidationBatchRow`, `ConsolidationBatchDetailSheet`, `ConsolidateCurrencySheet`, `ConsolidatePair`, `DisplaySettlement`
- Changes:
  1. Replace the raw `settlements` query with `useDisplaySettlementsQuery` for the history section
  2. Add `onConvert` to each involved `DebtRow` — opens `ConsolidateCurrencySheet` with ALL debts between that pair in this group
  3. Collect "all debts for a pair" by grouping `debts` by counterpart (one entry per user, regardless of currency count)
  4. Render `ConsolidationBatchRow` for batch items in history; `ConsolidationBatchDetailSheet` on tap

- [ ] **Step 1: Add imports**

At the top of `cost-share-app/apps/mobile/screens/balances/SettleUpListScreen.tsx`, add:
```typescript
import { DisplaySettlement, ConsolidationBatch } from '@cost-share/shared';
import {
    useDisplaySettlementsQuery,
    useDeleteConsolidationBatchMutation,
} from '../../hooks/queries/useConsolidationQueries';
import { ConsolidationBatchRow } from '../../components/ConsolidationBatchRow';
import { ConsolidationBatchDetailSheet } from '../../components/ConsolidationBatchDetailSheet';
import {
    ConsolidateCurrencySheet,
    ConsolidatePair,
} from '../../components/ConsolidateCurrencySheet';
import { platformAlert } from '../../lib/platformAlert';
```

- [ ] **Step 2: Replace settlement query, add batch state and per-pair debt map**

Find the settlement query block and extend the component:
```typescript
// REMOVE:
const { data: settlements = [], refetch: refetchSettlements } =
    useGroupSettlementsQuery(groupId);

// REPLACE WITH:
const { data: displaySettlements = [], refetch: refetchDisplaySettlements } =
    useDisplaySettlementsQuery(groupId);
const deleteBatchMutation = useDeleteConsolidationBatchMutation(groupId);

const [detailBatch, setDetailBatch] = useState<{
    batch: ConsolidationBatch;
    settlements: Settlement[];
} | null>(null);
const [consolidatePair, setConsolidatePair] = useState<ConsolidatePair | null>(null);

// All debts for each counterpart the current user is involved with,
// keyed by counterpartId. Works for 1 or more currencies.
const debtsByCounterpart = useMemo<Map<string, ConsolidatePair>>(() => {
    const map = new Map<string, ConsolidatePair>();
    for (const debt of debts) {
        if (debt.fromUserId !== currentUserId && debt.toUserId !== currentUserId) continue;
        const counterpartId =
            debt.fromUserId === currentUserId ? debt.toUserId : debt.fromUserId;
        const existing = map.get(counterpartId);
        if (existing) {
            existing.debts.push(debt);
        } else {
            map.set(counterpartId, {
                fromUserId: debt.fromUserId,
                toUserId: debt.toUserId,
                debts: [debt],
            });
        }
    }
    return map;
}, [debts, currentUserId]);
```

- [ ] **Step 3: Pass onConvert to each involved DebtRow**

In the `renderItem` / `FlatList` section where `DebtRow` is rendered for `involvedItems`, add:
```typescript
renderItem={({ item }) => {
    const counterpartId =
        item.debt.fromUserId === currentUserId
            ? item.debt.toUserId
            : item.debt.fromUserId;
    const pair = debtsByCounterpart.get(counterpartId);
    return (
        <DebtRow
            debt={item.debt}
            involved={item.involved}
            fromName={displayName(item.debt.fromUserId)}
            toName={displayName(item.debt.toUserId)}
            currentUserId={currentUserId}
            fromAvatar={memberAvatarFor(item.debt.fromUserId)}
            toAvatar={memberAvatarFor(item.debt.toUserId)}
            onPress={() => handleRowPress(item.debt)}
            onRemind={/* existing onRemind logic unchanged */}
            onConvert={pair ? () => setConsolidatePair(pair) : undefined}
        />
    );
}}
```

> **Note:** `onConvert` appears on the **first** `DebtRow` for each counterpart only (to avoid showing the button on every currency row for the same person). Apply the same "one per connection" logic used by `onRemind`:

```typescript
// Track which counterparts have already got the convert button
const seenConvertCounterparts = new Set<string>();

renderItem={({ item }) => {
    const counterpartId =
        item.debt.fromUserId === currentUserId
            ? item.debt.toUserId
            : item.debt.fromUserId;
    const pair = debtsByCounterpart.get(counterpartId);
    const showConvert = pair !== undefined && !seenConvertCounterparts.has(counterpartId);
    if (showConvert) seenConvertCounterparts.add(counterpartId);
    return (
        <DebtRow
            // …
            onConvert={showConvert ? () => setConsolidatePair(pair!) : undefined}
        />
    );
}}
```

- [ ] **Step 4: Update history section to render DisplaySettlement**

Replace the `sortedSettlements.map(...)` block in `ListFooterComponent` with:
```typescript
{displaySettlements.length > 0 ? (
    <View className="mt-8 mb-4">
        <View className="flex-row items-center mb-3 px-1">
            <View className="flex-1 h-px bg-gray-300" />
            <View className="flex-row items-center mx-3">
                <AppIcon name="time-outline" size={14} color={colors.gray500} />
                <Text className="ml-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
                    {t('balances.settlementHistory')}
                </Text>
            </View>
            <View className="flex-1 h-px bg-gray-300" />
        </View>
        <View className="rounded-2xl bg-slate-100/70 border border-gray-200 overflow-hidden">
            {displaySettlements.map((item, idx) => {
                const isLast = idx === displaySettlements.length - 1;
                if (item.kind === 'batch') {
                    return (
                        <ConsolidationBatchRow
                            key={item.batch.id}
                            batch={item.batch}
                            settlements={item.settlements}
                            currentUserId={currentUserId}
                            memberMap={memberMap}
                            onPress={() => setDetailBatch({ batch: item.batch, settlements: item.settlements })}
                        />
                    );
                }
                return (
                    <SettlementHistoryRow
                        key={item.settlement.id}
                        settlement={item.settlement}
                        fromName={displayName(item.settlement.fromUserId)}
                        toName={displayName(item.settlement.toUserId)}
                        currentUserId={currentUserId}
                        fromAvatar={memberAvatarFor(item.settlement.fromUserId)}
                        toAvatar={memberAvatarFor(item.settlement.toUserId)}
                        isLast={isLast}
                        onPress={() => handleSettlementRowPress(item.settlement)}
                    />
                );
            })}
        </View>
    </View>
) : null}
```

- [ ] **Step 5: Add batch delete handler and mount both sheets**

```typescript
const handleBatchDeleteRequest = useCallback(() => {
    if (!detailBatch) return;
    const target = detailBatch;
    platformAlert(t('settleUp.confirmDelete'), undefined, [
        { text: t('common.cancel'), style: 'cancel' },
        {
            text: t('common.delete'),
            style: 'destructive',
            onPress: () => {
                void (async () => {
                    const ok = await deleteBatchMutation.mutateAsync(target.batch.id);
                    if (ok) setDetailBatch(null);
                })();
            },
        },
    ]);
}, [detailBatch, deleteBatchMutation, t]);
```

Before the closing `</SafeAreaView>`:
```typescript
<ConsolidationBatchDetailSheet
    batch={detailBatch?.batch ?? null}
    settlements={detailBatch?.settlements ?? []}
    memberMap={memberMap}
    currentUserId={currentUserId}
    onClose={() => setDetailBatch(null)}
    onDelete={handleBatchDeleteRequest}
/>

<ConsolidateCurrencySheet
    visible={consolidatePair !== null}
    groupId={groupId}
    pair={consolidatePair}
    currentUserId={currentUserId}
    memberMap={memberMap}
    onClose={() => setConsolidatePair(null)}
/>
```

Also update the `RefreshControl` to refresh `displaySettlements`:
```typescript
onRefresh={() => {
    void refetch();
    void refetchDisplaySettlements();
}}
```

- [ ] **Step 6: Type-check**

```bash
cd cost-share-app/apps/mobile && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add cost-share-app/apps/mobile/screens/balances/SettleUpListScreen.tsx
git commit -m "feat(ui): wire onConvert per DebtRow and DisplaySettlement history in SettleUpListScreen"
```

---

## Task 10: SettlementHistoryScreen Refactor

**Files:**
- Modify: `cost-share-app/apps/mobile/screens/balances/SettlementHistoryScreen.tsx`

**Change:** Replace direct `fetchSettlements` call with `useDisplaySettlementsQuery`; render `ConsolidationBatchRow` for batches.

- [ ] **Step 1: Update SettlementHistoryScreen.tsx**

Replace the `useState<Settlement[]>` + manual `fetchSettlements` pattern with:
```typescript
import { DisplaySettlement, ConsolidationBatch, Settlement } from '@cost-share/shared';
import { useDisplaySettlementsQuery } from '../../hooks/queries/useConsolidationQueries';
import { useDeleteConsolidationBatchMutation } from '../../hooks/queries/useConsolidationQueries';
import { ConsolidationBatchRow } from '../../components/ConsolidationBatchRow';
import { ConsolidationBatchDetailSheet } from '../../components/ConsolidationBatchDetailSheet';
import { platformAlert } from '../../lib/platformAlert';
```

Replace the component body:
```typescript
export function SettlementHistoryScreen() {
    const { t } = useTranslation();
    const route = useRoute<any>();
    const { groupId } = route.params;
    const { data: allUsers = [] } = useGroupUsersQuery(groupId);

    const {
        data: displaySettlements = [],
        isLoading,
        refetch,
        isRefetching,
    } = useDisplaySettlementsQuery(groupId);

    const deleteBatchMutation = useDeleteConsolidationBatchMutation(groupId);
    const [detailBatch, setDetailBatch] = useState<{
        batch: ConsolidationBatch;
        settlements: Settlement[];
    } | null>(null);

    const currentUserId = useAppStore(s => s.currentUser?.id ?? '');

    const memberMap = useMemo<Record<string, GroupMemberLite>>(() => {
        const map: Record<string, GroupMemberLite> = {};
        for (const u of allUsers) {
            map[u.id] = {
                userId: u.id,
                displayName: getDisplayName(u, t),
                avatarUrl: getAvatarUrl(u) ?? undefined,
                isActive: u.isActive,
            };
        }
        return map;
    }, [allUsers, t]);

    const getUserName = (userId: string) =>
        getDisplayName(allUsers.find(u => u.id === userId) ?? null, t);

    const handleBatchDeleteRequest = () => {
        if (!detailBatch) return;
        const target = detailBatch;
        platformAlert(t('settleUp.confirmDelete'), undefined, [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('common.delete'),
                style: 'destructive',
                onPress: () => {
                    void (async () => {
                        const ok = await deleteBatchMutation.mutateAsync(target.batch.id);
                        if (ok) setDetailBatch(null);
                    })();
                },
            },
        ]);
    };

    const renderItem = ({ item }: { item: DisplaySettlement }) => {
        if (item.kind === 'batch') {
            return (
                <ConsolidationBatchRow
                    batch={item.batch}
                    settlements={item.settlements}
                    currentUserId={currentUserId}
                    memberMap={memberMap}
                    onPress={() => setDetailBatch({ batch: item.batch, settlements: item.settlements })}
                />
            );
        }
        const s = item.settlement;
        const formattedDate = new Date(s.settlementDate).toLocaleDateString();
        return (
            <View className="bg-white rounded-xl p-4 mb-2">
                <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                        <MemberAvatar name={getUserName(s.fromUserId)} size="sm" />
                        <View className="mx-2">
                            <Text className="text-gray-400">{isRtl ? '←' : '→'}</Text>
                        </View>
                        <MemberAvatar name={getUserName(s.toUserId)} size="sm" />
                        <View className="ml-3 flex-1">
                            <Text className="text-sm font-medium text-gray-900">
                                {getUserName(s.fromUserId)} {isRtl ? '←' : '→'} {getUserName(s.toUserId)}
                            </Text>
                            <Text className="text-xs text-gray-400 mt-0.5">
                                {formattedDate}
                                {s.paymentMethod && ` · ${t(`balances.methods.${s.paymentMethod}`)}`}
                            </Text>
                        </View>
                    </View>
                    <Text className="text-base font-bold text-green-600">
                        {s.currency} {s.amount.toFixed(2)}
                    </Text>
                </View>
            </View>
        );
    };

    if (isLoading && displaySettlements.length === 0) {
        return <LoadingIndicator />;
    }

    return (
        <View className="flex-1 bg-slate-50">
            <FlatList
                data={displaySettlements}
                keyExtractor={(item) =>
                    item.kind === 'batch' ? `batch:${item.batch.id}` : `settle:${item.settlement.id}`
                }
                renderItem={renderItem}
                contentContainerClassName="p-4"
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={refetch}
                        tintColor={colors.primary}
                    />
                }
                ListEmptyComponent={
                    <EmptyState
                        iconName="swap-horizontal-outline"
                        title={t('balances.noSettlements')}
                        message={t('balances.noSettlementsMessage')}
                    />
                }
            />
            <ConsolidationBatchDetailSheet
                batch={detailBatch?.batch ?? null}
                settlements={detailBatch?.settlements ?? []}
                memberMap={memberMap}
                currentUserId={currentUserId}
                onClose={() => setDetailBatch(null)}
                onDelete={handleBatchDeleteRequest}
            />
        </View>
    );
}
```

You'll need to add these imports:
```typescript
import { useState, useMemo } from 'react';
import { GroupMemberLite, ConsolidationBatch } from '@cost-share/shared';
import { useAppStore } from '../../store';
import { getDisplayName, getAvatarUrl } from '../../lib/userDisplay';
import { useRtlLayout } from '../../hooks/useRtlLayout';
```

- [ ] **Step 2: Type-check**

```bash
cd cost-share-app/apps/mobile && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add cost-share-app/apps/mobile/screens/balances/SettlementHistoryScreen.tsx
git commit -m "feat(ui): refactor SettlementHistoryScreen to use DisplaySettlement"
```

---

## Task 11: ActivityFeedScreen and ActivityItem — Handle consolidation_batch_added

**Files:**
- Modify: `cost-share-app/apps/mobile/components/ActivityItem.tsx`
- Modify: `cost-share-app/apps/mobile/screens/activity/ActivityFeedScreen.tsx`

**Change:** `ActivityItem` renders a new card layout for `consolidation_batch_added` events. `ActivityFeedScreen` provides batch metadata (payment_amount, payment_currency, paid_by_user_id from `event.metadata`) and routes taps to `ConsolidationBatchDetailSheet`.

- [ ] **Step 1: Update ActivityItem to handle consolidation_batch_added**

Open `cost-share-app/apps/mobile/components/ActivityItem.tsx`.

Inside the `titleOverride` block (around line 66), add a branch for `consolidation_batch_added`:
```typescript
if (event.kind === 'consolidation_batch_added') {
    const md = event.metadata ?? {};
    const paidById = md.paid_by_user_id as string | undefined;
    const paymentAmount = Number(md.payment_amount ?? 0);
    const paymentCurrency = (md.payment_currency as string | undefined) ?? '';
    const paidByName =
        paidById === currentUserId
            ? t('common.you')
            : (paidById === actor?.userId ? actorName : getDisplayNameForMember(counterpart ?? null, t));
    const amountText = `${paymentCurrency} ${paymentAmount.toFixed(2)}`;
    titleOverride =
        paidById === currentUserId
            ? t('consolidation.youConsolidatedActivity', { amount: amountText })
            : t('consolidation.theyConsolidatedActivity', { name: paidByName, amount: amountText });
}
```

Add i18n keys to `en.json` under `consolidation`:
```json
"youConsolidatedActivity": "You consolidated debts → {{amount}}",
"theyConsolidatedActivity": "{{name}} consolidated debts → {{amount}}"
```

- [ ] **Step 2: Update ActivityFeedScreen to route consolidation_batch_added**

Open `cost-share-app/apps/mobile/screens/activity/ActivityFeedScreen.tsx`.

Find where `settlement_added` events are tapped to open `FeedItemDetailSheet`. Add handling for `consolidation_batch_added` that opens `ConsolidationBatchDetailSheet`. The batch detail requires knowing the settlements under the batch — fetch them lazily when the sheet opens by looking up the batch via `useDisplaySettlementsQuery` or a dedicated query.

Since `ActivityFeedScreen` already has access to `groupId` from event, add:
```typescript
import { ConsolidationBatchDetailSheet } from '../../components/ConsolidationBatchDetailSheet';
import { fetchConsolidationBatches } from '../../services/settlements.service';
import { fetchSettlements } from '../../services/settlements.service';
// State for tapped batch
const [batchDetail, setBatchDetail] = useState<{
    batch: ConsolidationBatch;
    settlements: Settlement[];
    groupId: string;
} | null>(null);
```

In the event `onPress` handler, add:
```typescript
if (event.kind === 'consolidation_batch_added') {
    const batchId = event.refId; // ref_id points to consolidation_batches.id
    const groupId = event.groupId ?? '';
    // Fetch batch + its settlements
    const [batches, settlements] = await Promise.all([
        fetchConsolidationBatches(groupId),
        fetchSettlements(groupId),
    ]);
    const batch = batches.find(b => b.id === batchId);
    if (!batch) return;
    const batchSettlements = settlements.filter(s => s.consolidationBatchId === batchId);
    setBatchDetail({ batch, settlements: batchSettlements, groupId });
    return;
}
```

Add the sheet to the render:
```typescript
<ConsolidationBatchDetailSheet
    batch={batchDetail?.batch ?? null}
    settlements={batchDetail?.settlements ?? []}
    memberMap={memberMapForGroup(batchDetail?.groupId ?? '')}
    currentUserId={currentUserId}
    onClose={() => setBatchDetail(null)}
    onDelete={() => {
        // Batch deletion from activity feed is not supported (no groupId context for mutations)
        // Show a toast directing to the group's settle-up screen
        showErrorToast('consolidation.deleteFromFeedUnsupported', 'common.openGroup');
        setBatchDetail(null);
    }}
/>
```

> **Note:** Review the existing `ActivityFeedScreen.tsx` structure before patching — it may use a different event-tap pattern. Adapt the above to fit the existing handler structure rather than replacing it wholesale.

- [ ] **Step 3: Type-check**

```bash
cd cost-share-app/apps/mobile && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add cost-share-app/apps/mobile/components/ActivityItem.tsx \
        cost-share-app/apps/mobile/screens/activity/ActivityFeedScreen.tsx
git commit -m "feat(ui): handle consolidation_batch_added in ActivityItem and ActivityFeedScreen"
```

---

## Task 12: FeedItemDetailSheet, SettlementRow, and GroupDetailScreen — Pass-Through for DisplaySettlement

**Files:**
- Modify: `cost-share-app/apps/mobile/components/FeedItemDetailSheet.tsx`
- Modify: `cost-share-app/apps/mobile/components/SettlementRow.tsx`

**Change:** `FeedItemDetailSheet` and `SettlementRow` currently accept `Settlement`. All callers that pass raw settlements can continue to do so. Callers that pass `DisplaySettlement` need to unwrap standalone items. Add a convenience `unwrapDisplaySettlement` helper so callers can safely unwrap before passing to these components.

> **Why:** FeedItemDetailSheet and SettlementRow are render-only; they don't need to know about batches. Rather than replacing their props, callers unwrap `standalone` items before passing them in. Batch items are handled by `ConsolidationBatchRow` / `ConsolidationBatchDetailSheet`.

- [ ] **Step 1: Add unwrapDisplaySettlement to shared**

Open `cost-share-app/packages/shared/src/calculations/groupSettlementsForDisplay.ts` and add:
```typescript
/**
 * Returns the Settlement for a standalone DisplaySettlement, or null for a batch.
 * Use to pass settlements to components that only understand raw Settlement.
 */
export function unwrapDisplaySettlement(item: DisplaySettlement): Settlement | null {
    return item.kind === 'standalone' ? item.settlement : null;
}
```

Export from barrel (`packages/shared/src/index.ts`):
```typescript
export { groupSettlementsForDisplay, unwrapDisplaySettlement } from './calculations/groupSettlementsForDisplay';
```

- [ ] **Step 2: Update GroupDetailScreen (if it renders settlements in feed)**

Search for the GroupDetailScreen file:
```bash
find cost-share-app/apps/mobile -name "GroupDetailScreen*" -not -path "*/node_modules/*"
```

Open it. If it renders settlement FeedItems from a feed built with raw `Settlement[]`, switch to `useDisplaySettlementsQuery` and render `ConsolidationBatchRow` for batch items. Follow the same pattern as SettleUpListScreen Task 8.

If `GroupDetailScreen` uses `FeedItem` (the existing union type `{ kind: 'settlement'; settlement: Settlement }`), update the `FeedItem` union to allow batch items:

In `cost-share-app/packages/shared/src/types/index.ts`, extend `FeedItem`:
```typescript
export type FeedItem =
    | { kind: 'expense'; sortAt: Date; expense: ExpenseWithDelta }
    | { kind: 'message'; sortAt: Date; message: GroupMessage }
    | { kind: 'settlement'; sortAt: Date; settlement: Settlement }
    | { kind: 'consolidation_batch'; sortAt: Date; batch: ConsolidationBatch; settlements: Settlement[] };
```

Update any switch/exhaustive checks over `FeedItem.kind` in GroupDetailScreen to handle the new variant by rendering `ConsolidationBatchRow`.

- [ ] **Step 3: Type-check the full workspace**

```bash
cd cost-share-app/apps/mobile && npx tsc --noEmit
cd cost-share-app/packages/shared && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Run existing tests to guard against regressions**

```bash
cd cost-share-app/apps/mobile && npx jest
```
Expected: all pre-existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add -p   # stage only the relevant files
git commit -m "feat(ui): wire DisplaySettlement across FeedItemDetailSheet, SettlementRow, and GroupDetailScreen"
```

---

## Self-Review Checklist

**Spec coverage:**

| Requirement | Task |
|-------------|------|
| `consolidation_batches` table | Task 1 |
| `settlements.consolidation_batch_id`, `exchange_rate` columns | Task 1 |
| Atomic RPC `create_consolidation_batch` | Task 1 |
| Soft-delete RPC `delete_consolidation_batch` | Task 1 |
| `ConsolidationBatch` + `DisplaySettlement` types | Task 2 |
| `consolidationBatchFromRow` mapper | Task 2 |
| Updated `settlementFromRow` (new columns) | Task 2 |
| `groupSettlementsForDisplay` transform | Task 3 |
| `fetchConsolidationBatches` | Task 4 |
| `createConsolidationBatch` service | Task 4 |
| `deleteConsolidationBatch` service | Task 4 |
| `useDisplaySettlementsQuery` hook | Task 5 |
| `useCreateConsolidationBatchMutation` | Task 5 |
| `useDeleteConsolidationBatchMutation` | Task 5 |
| `ConsolidationBatchRow` component | Task 6 |
| `ConsolidationBatchDetailSheet` component | Task 6 |
| Ad gate → currency picker → confirm flow | Task 7 |
| i18n keys for consolidation | Task 7 |
| SettleUpListScreen: "Convert all" button | Task 8 |
| SettleUpListScreen: batch history rendering | Task 8 |
| SettlementHistoryScreen: DisplaySettlement rendering | Task 9 |
| ActivityItem: `consolidation_batch_added` event | Task 10 |
| ActivityFeedScreen: route batch tap to detail sheet | Task 10 |
| `FeedItem` union extended for batch | Task 11 |
| GroupDetailScreen: batch in interleaved feed | Task 11 |
| Batch shows as ONE card everywhere | Tasks 6, 8, 9, 10, 11 |
| Delete batch soft-deletes batch + all settlements | Task 1 (RPC), Task 8 & 9 (UI) |
| Balance math unchanged (uses raw settlements) | Verified: `useGroupSettlementsQuery` still used by `useSimplifiedDebts` path |
| No editing of consolidated settlements | `ConsolidationBatchDetailSheet` exposes only Delete, no Edit |
| `consolidation_batch_added` activity event (not per-settlement) | Task 1 (trigger suppresses per-settlement events in batch) |

**Gaps / notes:**
- Push notification routing: search for where `settlement_added` push notifications are dispatched (likely in `push_webhook_trigger` migration or an Edge Function). Add a case for `consolidation_batch_added` that sends "X consolidated their debts with you". This is left to a follow-on task since it requires locating the push dispatch logic.
- Exchange rate sourcing in `ConsolidateCurrencySheet`: `useExchangeRates` is assumed to exist. Verify its signature matches how it's called in Task 7 (`useExchangeRates(baseCurrency, symbols)`). If the hook has a different API, adapt Task 7 accordingly.
- The settlement trigger replacement in Task 1 assumes an existing `handle_settlement_activity_event` function. Verify the actual trigger name in the DB before running the migration; rename to match if needed.
