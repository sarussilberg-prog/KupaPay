# Amount Colors (Green/Red/Black by Viewer Net) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Color the main amount text in transaction cards by the viewer's net effect (green when owed, red when owing, black when neutral/uninvolved) on both the Activity feed and the Group screen, for expense and settlement cards, sourcing viewer direction from the existing canonical computation.

**Architecture:** A single pure helper (`viewerAmountTone`) maps a signed net number to a `'positive' | 'negative' | 'neutral'` tone, and a `viewerAmountToneClass` mapper turns that tone into a Tailwind color class (`text-green-600` / `text-red-500` / `text-gray-900`, matching the existing SummaryBalanceStrip green/red convention). A backend migration extends the `expense_added` activity fan-out so each per-recipient `activity_events` row carries that recipient's signed net for the expense in `metadata.viewer_delta` (paid − share); the Activity card then colors expense amounts from that field (new events colored; pre-existing events without the field render black). The Activity card also derives the settlement viewer direction from `from_user_id`/`to_user_id` already present in `event.metadata` (fixing the settlement-always-green bug), and the consolidation direction from `paid_to_user_id`/`paid_by_user_id`. The Group screen's `FeedRowCard`/`FeedAmountLine` gain an optional `amountClassName`, and `ExpenseRow` (from `myDeltaState`/`myDelta`) and `SettlementRow` (from `fromUserId`/`toUserId`) pass the viewer tone class.

**Tech Stack:** React Native (Expo), TypeScript, NativeWind (Tailwind classes on `AppText`), jest + `jest-expo` + `@testing-library/react-native`.

---

## File Structure

| File | Change | Responsibility |
|------|--------|----------------|
| `cost-share-app/supabase/migrations/20260706120000_activity_expense_viewer_delta.sql` | **Create** | Extend `emit_expense_activity_events` to seed each recipient row's `metadata.viewer_delta` (payer gets `+amount`, non-payers `0`) at expense-insert time, and add `emit_expense_split_viewer_delta` (`AFTER INSERT OR UPDATE ON expense_splits`) to correct each participant's row to `paid − share`. |
| `cost-share-app/supabase/__tests__/activity_expense_viewer_delta.test.sql` | **Create** | PL/pgSQL rollback test: payer row `viewer_delta > 0`, non-paying participant `< 0`, participant who paid exactly their share `= 0`. |
| `cost-share-app/apps/mobile/lib/viewerAmountTone.ts` | **Create** | Pure `viewerAmountTone(net)` + `viewerAmountToneClass(tone)` helpers (single source for the color mapping). |
| `cost-share-app/apps/mobile/__tests__/lib/viewerAmountTone.test.ts` | **Create** | Unit tests for the helper (positive/negative/zero/NaN, class mapping). |
| `cost-share-app/apps/mobile/lib/activityCardVariant.ts` | **Modify** | Replace type-keyed `activityCardAmountClass` usage with a viewer-net-driven color for the amount (add `activityCardAmountClassForNet`). |
| `cost-share-app/apps/mobile/components/ActivityItemCard.tsx` | **Modify** | Compute the viewer's signed net (expenses from metadata `viewer_delta`; settlements from `from_user_id`/`to_user_id` vs `event.userId`; consolidations from `paid_to_user_id`/`paid_by_user_id`) and color the amount `Text` by it. |
| `cost-share-app/apps/mobile/__tests__/components/ActivityItemCard.test.tsx` | **Modify** | Add tests: settlement to-viewer → green, settlement from-viewer → red, third-party settlement → black, expense with positive `viewer_delta` → green, expense with negative → red, expense without `viewer_delta` → black. |
| `cost-share-app/apps/mobile/components/FeedRowCard.tsx` | **Modify** | `FeedRowCard` accepts optional `amountClassName`; default keeps `text-gray-900`. |
| `cost-share-app/apps/mobile/__tests__/components/FeedRowCard.test.tsx` | **Modify** | Add test: `amountClassName` reaches the amount `Text`. |
| `cost-share-app/apps/mobile/components/ExpenseRow.tsx` | **Modify** | Derive tone from `myDeltaState`/`myDelta`, pass `amountClassName` to `FeedRowCard`. |
| `cost-share-app/apps/mobile/__tests__/components/ExpenseRow.test.tsx` | **Modify** | Add tests: lent → green amount, borrowed → red amount, settled → black amount. |
| `cost-share-app/apps/mobile/components/SettlementRow.tsx` | **Modify** | Derive tone from `fromUserId`/`toUserId` vs `currentUserId`, pass `amountClassName`. |
| `cost-share-app/apps/mobile/__tests__/components/SettlementRow.test.tsx` | **Modify** | Add tests: viewer paid → red, viewer was paid → green, third-party → black. |

### Test-run command (worktree-safe)

All jest commands below are run from `cost-share-app/apps/mobile` and disable watchman (jest is flaky in worktrees without it):

```bash
cd cost-share-app/apps/mobile && npx jest <test-path> --watchman=false
```

> **Prerequisite:** dependencies must be installed at the monorepo (`cost-share-app`) level (`npm install` from `cost-share-app`) — otherwise `jest-expo` preset resolution fails with "Preset jest-expo not found".

---

## Key facts discovered from reading the code (do not re-derive)

- **Green/red convention to mirror** — `SummaryBalanceStrip.tsx` uses `owed ? colors.success.text : colors.error` for the *inline sentence*, and the `CurrencyChip` uses the Tailwind classes `text-green-600` (owed) / `text-red-500` (owe). We mirror the **Tailwind class** convention (`text-green-600` / `text-red-500`) because the amount `Text` is already styled via `className`, and existing tests assert on `.props.className`.
- **Activity settlement metadata carries viewer direction.** `supabase/migrations/20260526105507_activity_events.sql` (lines 176-182) writes `from_user_id`, `to_user_id`, `amount`, `currency` into settlement `activity_events.metadata`. `ActivityItemCard` receives `event` and can compare these against `event.userId` (the feed row's recipient = the viewer). This is the fix for the settlement-always-green bug.
- **Activity expense metadata now carries the viewer's signed net (`viewer_delta`), added by Task 0.** The *current* `expense_added` fan-out (`emit_expense_activity_events`, latest definition in `supabase/migrations/20260618192600_activity_events_edited_deleted_flags.sql` lines 20-90) writes only `description`, `amount`, `currency`, `expense_date` — no payer, no splits, no per-user delta. Task 0 (below) extends this so each recipient row also carries `metadata.viewer_delta` = that recipient's signed net for the expense (paid − share). New events get this field and are colored; pre-existing rows (backfilled or created before Task 0) have no `viewer_delta` and render **black** — an accepted product limitation. `ActivityFeedScreen.openExpenseDetail` still stubs `splits: [], myDelta: 0` for the detail sheet, which is unrelated to the card color.
- **Splits do NOT exist at `AFTER INSERT ON expenses` time.** `create_expense_with_splits` (`supabase/migrations/20260622130000_create_expense_with_splits_rpc.sql` lines 67-86) inserts the `expenses` row FIRST — which synchronously fires the plain per-row `AFTER INSERT` trigger `trg_expense_activity_events` — and inserts `expense_splits` AFTER. Verified empirically on dev (`drxfbicunusmipdgbgdk`): a probe `AFTER INSERT ON expenses` trigger sees **0** split rows for the new expense. So the expense-side trigger can only seed the *payer's* delta (payer paid the full `NEW.amount`); every participant's share becomes known only when their `expense_splits` row is written. Task 0 therefore uses a **two-trigger** design: (a) expense-side seeds `viewer_delta = NEW.amount` for the payer's row and `0` for everyone else; (b) a new `AFTER INSERT OR UPDATE ON expense_splits` trigger corrects each participant's row to `paid − share`. There is already an `AFTER INSERT OR UPDATE ON expense_splits` trigger (`clear_archive_on_expense_split`), so a second split-side trigger is an established pattern.
- **`expenses` schema:** `paid_by UUID NOT NULL` (single payer), `amount DECIMAL(12,2)`, `currency VARCHAR(3)`. **`expense_splits` schema:** `expense_id`, `user_id`, `amount DECIMAL(12,2)` (that user's share), `UNIQUE(expense_id, user_id)`. So each recipient's delta = `(user_id = paid_by ? amount : 0) − COALESCE(split.amount, 0)`.
- **`event.userId`** (from `ActivityEvent`, `packages/shared/src/types/index.ts` line 286) is the per-user feed-row owner = the viewer for that row. `ActivityItemCard` is display-only and does not currently receive `currentUserId`, but `event.userId` is exactly the viewer id, so no new prop is needed.
- **`ExpenseWithDelta`** (`packages/shared/src/types/index.ts` lines 709-713) has `myDelta: number` and `myDeltaState: 'lent' | 'borrowed' | 'settled'`. `ExpenseRow` already reads these for the borrowed/lent sub-line. `lent` ⇒ viewer is owed ⇒ green; `borrowed` ⇒ viewer owes ⇒ red; `settled`/zero ⇒ black.
- **`Settlement`** has `fromUserId` (payer) and `toUserId` (payee). `SettlementRow` already resolves the viewer perspective for copy via `buildSettlementFeedCopy`. Payee = viewer ⇒ +amount ⇒ green; payer = viewer ⇒ −amount ⇒ red; neither ⇒ black.
- **`AppText`** (`components/AppText.tsx`) forwards `className` (merged with RTL classes) to the underlying RN `Text`, so `.props.className` on a queried `Text` contains our color class. Existing tests assert exactly this way (`__tests__/components/AppText.test.tsx`, `AppBrandTitle.test.tsx`).
- **`colors`** (`theme/colors.ts`): `success.text = '#047857'`, `error = '#EF4444'`. We use Tailwind classes rather than these hex values for the amount text to stay consistent with existing `.props.className` assertions and the `CurrencyChip` precedent. (`text-green-600` = `#16A34A`, `text-red-500` = `#EF4444`, `text-gray-900` = `#111827`.)

---

## Task 0 — Backend: expose per-recipient `viewer_delta` on `expense_added` activity events

This task must land BEFORE Task 2 (the Activity screen reads the new field). It ships one migration and one SQL regression test (test written first). Apply to dev `drxfbicunusmipdgbgdk` first (via the `supabase` MCP `apply_migration`/`execute_sql`), then — only after the dev test passes and the user approves — prod `jfqxjjjbpxbwwvoygahu` (via the `supabase-prod` MCP). This plan document does not itself apply anything; the executing agent runs the steps.

**Files:**
- Create: `cost-share-app/supabase/migrations/20260706120000_activity_expense_viewer_delta.sql`
- Test: `cost-share-app/supabase/__tests__/activity_expense_viewer_delta.test.sql`

**The current function (quoted, do not re-derive).** The latest definition of `emit_expense_activity_events` is in `cost-share-app/supabase/migrations/20260618192600_activity_events_edited_deleted_flags.sql` (lines 20-90). Confirmed live on dev via `pg_get_functiondef('emit_expense_activity_events'::regproc)` — the deployed body matches that migration exactly. The relevant INSERT branch fans out one row per active member:

```sql
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
```

Splits are not visible here (see Key facts: the expense row is inserted before its `expense_splits`), so this branch can only seed the payer's delta. A second trigger on `expense_splits` fills in each participant's share.

**`viewer_delta` contract (key name + sign):**
- Key: `metadata.viewer_delta` (numeric, currency units of `metadata.currency`).
- Sign: `viewer_delta = paid − share` for the row's `user_id`, where `paid = (user_id = expenses.paid_by ? expenses.amount : 0)` and `share = COALESCE(expense_splits.amount for that user, 0)`.
- `> 0` ⇒ viewer is a net creditor on this expense (green); `< 0` ⇒ net debtor (red); `= 0` ⇒ paid exactly their share / not involved (black). Absent ⇒ pre-Task-0 event (black).
- Single-currency per expense (`expenses.currency` is one column), so no mixed-currency ambiguity within a card.

- [ ] **0.1 Write the failing SQL regression test (test first).** Create `cost-share-app/supabase/__tests__/activity_expense_viewer_delta.test.sql` with the COMPLETE contents (style copied from `activity_events.test.sql`: `BEGIN; SET LOCAL session_replication_role = replica; ALTER TABLE ... ENABLE ALWAYS TRIGGER; DO $outer$...$outer$; ROLLBACK;`, hex-only uuids, `IF <bad> THEN RAISE EXCEPTION 'Case N failed...'`, forcing `auth.uid()` via `set_config('request.jwt.claim.sub', ...)`):

```sql
-- ============================================================================
-- SQL regression tests for expense_added activity events carrying the
-- recipient's signed viewer_delta (paid − share).
--
-- Run via Supabase MCP:
--   mcp__supabase__execute_sql with the full contents below against the dev
--   project (drxfbicunusmipdgbgdk). The transaction ROLLBACKs at the end so
--   no data persists.
--
-- Mirrors activity_events.test.sql: session_replication_role = replica
-- disables the auth.users FK trigger; we ENABLE ALWAYS the activity triggers
-- under test (the two expense triggers) so they still fire.
-- ============================================================================

BEGIN;

SET LOCAL session_replication_role = replica;

-- Re-enable the triggers under test (replica mode disables them).
ALTER TABLE expenses       ENABLE ALWAYS TRIGGER trg_expense_activity_events;
ALTER TABLE expense_splits ENABLE ALWAYS TRIGGER trg_expense_split_viewer_delta;

DO $outer$
DECLARE
    v_group   CONSTANT UUID := '00000000-0000-0000-0000-0000000ed001';
    v_alice   CONSTANT UUID := '00000000-0000-0000-0000-0000000ed0a1';  -- payer
    v_bob     CONSTANT UUID := '00000000-0000-0000-0000-0000000ed0b1';  -- borrows
    v_carol   CONSTANT UUID := '00000000-0000-0000-0000-0000000ed0c1';  -- paid own share
    v_exp     UUID;
    v_delta_a NUMERIC;
    v_delta_b NUMERIC;
    v_delta_c NUMERIC;
    v_present BOOLEAN;
BEGIN
    -- Force auth.uid() (some branches read it); Alice is the actor.
    PERFORM set_config('request.jwt.claim.sub', v_alice::text, true);

    -- ---- seed ----------------------------------------------------------
    INSERT INTO auth.users (id) VALUES (v_alice), (v_bob), (v_carol);
    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token)
    VALUES
        (v_alice, 'ed-alice@test.local', 'Alice', 'USD', 'en', TRUE, 'tt_ed_alice'),
        (v_bob,   'ed-bob@test.local',   'Bob',   'USD', 'en', TRUE, 'tt_ed_bob'),
        (v_carol, 'ed-carol@test.local', 'Carol', 'USD', 'en', TRUE, 'tt_ed_carol');
    INSERT INTO public.groups (id, name, default_currency, created_by, is_active, group_type, invite_token)
    VALUES (v_group, 'ED Test Group', 'USD', v_alice, TRUE, 'general', 'tt_ed_group');
    INSERT INTO public.group_members (group_id, user_id, is_active, joined_at) VALUES
        (v_group, v_alice, TRUE, now()),
        (v_group, v_bob,   TRUE, now()),
        (v_group, v_carol, TRUE, now());

    -- Alice pays 30. Splits: Alice 10, Bob 10, Carol 10.
    --   Alice: paid 30, share 10 → delta +20  (net creditor)
    --   Bob:   paid  0, share 10 → delta -10  (net debtor)
    --   Carol: paid  0, share 10 → delta -10
    -- To exercise the "= 0" case we make Carol both pay and owe her share by
    -- using a separate expense below; here Bob and Carol are symmetric debtors.
    INSERT INTO public.expenses (group_id, paid_by, amount, currency, description, expense_date, created_by, is_deleted)
    VALUES (v_group, v_alice, 30, 'USD', 'Dinner', CURRENT_DATE, v_alice, FALSE)
    RETURNING id INTO v_exp;

    -- Splits inserted AFTER the expense (mirrors create_expense_with_splits),
    -- so the split-side trigger is what fills viewer_delta for participants.
    INSERT INTO public.expense_splits (expense_id, user_id, amount) VALUES
        (v_exp, v_alice, 10),
        (v_exp, v_bob,   10),
        (v_exp, v_carol, 10);

    -- ---- CASE 1: payer's row delta > 0 --------------------------------
    SELECT (metadata->>'viewer_delta')::numeric INTO v_delta_a
    FROM activity_events
    WHERE kind = 'expense_added' AND ref_id = v_exp AND user_id = v_alice;
    IF v_delta_a IS NULL OR v_delta_a <= 0 THEN
        RAISE EXCEPTION 'Case 1 failed: payer viewer_delta should be > 0, got %', v_delta_a;
    END IF;
    IF v_delta_a <> 20 THEN
        RAISE EXCEPTION 'Case 1 failed: payer viewer_delta should be 20 (30 paid - 10 share), got %', v_delta_a;
    END IF;

    -- ---- CASE 2: non-paying participant's row delta < 0 ---------------
    SELECT (metadata->>'viewer_delta')::numeric INTO v_delta_b
    FROM activity_events
    WHERE kind = 'expense_added' AND ref_id = v_exp AND user_id = v_bob;
    IF v_delta_b IS NULL OR v_delta_b >= 0 THEN
        RAISE EXCEPTION 'Case 2 failed: non-paying participant viewer_delta should be < 0, got %', v_delta_b;
    END IF;
    IF v_delta_b <> -10 THEN
        RAISE EXCEPTION 'Case 2 failed: Bob viewer_delta should be -10 (0 paid - 10 share), got %', v_delta_b;
    END IF;

    -- ---- CASE 3: participant who paid exactly their share → delta 0 ----
    -- Second expense: Carol pays 12, and her only split is her own 12.
    INSERT INTO public.expenses (group_id, paid_by, amount, currency, description, expense_date, created_by, is_deleted)
    VALUES (v_group, v_carol, 12, 'USD', 'Solo snack', CURRENT_DATE, v_carol, FALSE)
    RETURNING id INTO v_exp;

    INSERT INTO public.expense_splits (expense_id, user_id, amount) VALUES
        (v_exp, v_carol, 12);

    SELECT (metadata->>'viewer_delta')::numeric INTO v_delta_c
    FROM activity_events
    WHERE kind = 'expense_added' AND ref_id = v_exp AND user_id = v_carol;
    IF v_delta_c IS NULL OR v_delta_c <> 0 THEN
        RAISE EXCEPTION 'Case 3 failed: participant who paid exactly their share should have viewer_delta 0, got %', v_delta_c;
    END IF;

    -- A member of the group who is NOT in the splits (Alice, Bob) still gets a
    -- fan-out row for this second expense (fan-out is per active member), and
    -- since they neither paid nor have a share their delta must be 0.
    SELECT (metadata ? 'viewer_delta'), (metadata->>'viewer_delta')::numeric
      INTO v_present, v_delta_a
    FROM activity_events
    WHERE kind = 'expense_added' AND ref_id = v_exp AND user_id = v_bob;
    IF NOT v_present OR v_delta_a <> 0 THEN
        RAISE EXCEPTION 'Case 3 failed: uninvolved member viewer_delta should be present and 0, got present=% delta=%', v_present, v_delta_a;
    END IF;

    RAISE NOTICE 'All activity_expense_viewer_delta tests passed.';
END
$outer$;

ROLLBACK;
```

- [ ] **0.2 Run the test, expect it to FAIL (trigger + field do not exist yet).** Run the full file contents through `mcp__supabase__execute_sql` against dev `drxfbicunusmipdgbgdk` (paste the file body as the `query`). Expected failure: the `ALTER TABLE expense_splits ENABLE ALWAYS TRIGGER trg_expense_split_viewer_delta;` statement errors because the trigger does not exist yet —

```
ERROR:  trigger "trg_expense_split_viewer_delta" for table "expense_splits" does not exist
```

(The transaction aborts before any assertion runs; nothing is committed.)

- [ ] **0.3 Write the migration (minimal, complete).** Create `cost-share-app/supabase/migrations/20260706120000_activity_expense_viewer_delta.sql` with the COMPLETE contents:

```sql
-- 2026-07-06 — Per-recipient viewer_delta on expense_added activity events.
--
-- WHY: the Activity screen colors the main amount by the viewer's net effect on
-- the expense (green when owed, red when owing, black when even/uninvolved). The
-- existing expense_added fan-out metadata carried no per-user delta, so activity
-- expenses could not be colored. This migration adds metadata.viewer_delta =
-- paid − share for the row's user_id.
--
-- Two triggers are needed because expense_splits do NOT exist when the AFTER
-- INSERT trigger on `expenses` fires (create_expense_with_splits inserts the
-- expense first, then the splits):
--   1. emit_expense_activity_events (expenses): seed viewer_delta from the
--      payer only — payer paid NEW.amount, everyone else 0 so far.
--   2. emit_expense_split_viewer_delta (expense_splits): once a participant's
--      split lands, correct that recipient's row to paid − share.
--
-- Pre-existing / backfilled rows keep no viewer_delta and render black on the
-- client. New events get colored going forward. Applies dev
-- (drxfbicunusmipdgbgdk) first, then prod (jfqxjjjbpxbwwvoygahu) after approval.

BEGIN;

-- ============================================================================
-- 1. emit_expense_activity_events — seed viewer_delta from the payer.
--    Unchanged from 20260618192600 except the INSERT branch's jsonb payload,
--    which now also writes 'viewer_delta' (payer → NEW.amount, others → 0).
-- ============================================================================
CREATE OR REPLACE FUNCTION emit_expense_activity_events() RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
        -- INSERT or un-delete: fan-out new rows to all active members.
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
                    'expense_date', NEW.expense_date,
                    -- Payer paid the full amount; splits (shares) are applied by
                    -- the expense_splits trigger below. Non-payers start at 0.
                    'viewer_delta',
                        CASE WHEN gm.user_id = NEW.paid_by THEN NEW.amount ELSE 0 END
                ),
                NEW.created_at
            FROM group_members gm
            WHERE gm.group_id = NEW.group_id AND gm.is_active = true
            ON CONFLICT (user_id, kind, ref_id) DO NOTHING;

        -- Content edit: refresh metadata + bump created_at, and mark is_edited.
        -- Re-seed viewer_delta from the payer; the split trigger re-applies
        -- shares if the amount/splits changed.
        ELSIF TG_OP = 'UPDATE' AND NEW.is_deleted = false
              AND (OLD.description  IS DISTINCT FROM NEW.description
                   OR OLD.amount    IS DISTINCT FROM NEW.amount
                   OR OLD.currency  IS DISTINCT FROM NEW.currency
                   OR OLD.expense_date IS DISTINCT FROM NEW.expense_date) THEN
            UPDATE activity_events ae
            SET metadata = jsonb_build_object(
                    'description', NEW.description,
                    'amount',      NEW.amount,
                    'currency',    NEW.currency,
                    'expense_date', NEW.expense_date,
                    'is_edited',   true,
                    'edited_at',   NOW(),
                    'viewer_delta',
                        CASE WHEN ae.user_id = NEW.paid_by THEN NEW.amount ELSE 0 END
                        - COALESCE((
                            SELECT es.amount FROM expense_splits es
                            WHERE es.expense_id = NEW.id AND es.user_id = ae.user_id
                        ), 0)
                ),
                created_at = NOW()
            WHERE ae.kind = 'expense_added' AND ae.ref_id = NEW.id;
        END IF;

        -- Soft-delete: mark rows deleted in-place (unchanged).
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

-- Trigger definition unchanged; recreate idempotently for safety.
DROP TRIGGER IF EXISTS trg_expense_activity_events ON expenses;
CREATE TRIGGER trg_expense_activity_events
    AFTER INSERT OR UPDATE OF is_deleted, description, amount, currency, expense_date ON expenses
    FOR EACH ROW EXECUTE FUNCTION emit_expense_activity_events();

-- ============================================================================
-- 2. emit_expense_split_viewer_delta — correct each participant's row once
--    their split (share) is known. Fires per split row on INSERT/UPDATE.
--    viewer_delta = (row user paid ? expense.amount : 0) − split.amount.
-- ============================================================================
CREATE OR REPLACE FUNCTION emit_expense_split_viewer_delta() RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
        v_amount  NUMERIC;
        v_paid_by UUID;
    BEGIN
        SELECT e.amount, e.paid_by INTO v_amount, v_paid_by
        FROM expenses e WHERE e.id = NEW.expense_id;

        IF v_amount IS NULL THEN
            RETURN NEW;  -- expense gone (shouldn't happen inside one txn)
        END IF;

        UPDATE activity_events
        SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                'viewer_delta',
                (CASE WHEN NEW.user_id = v_paid_by THEN v_amount ELSE 0 END) - NEW.amount
            )
        WHERE kind = 'expense_added'
          AND ref_id = NEW.expense_id
          AND user_id = NEW.user_id;

        RETURN NEW;
    END;
    $$;

REVOKE EXECUTE ON FUNCTION emit_expense_split_viewer_delta() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_expense_split_viewer_delta ON expense_splits;
CREATE TRIGGER trg_expense_split_viewer_delta
    AFTER INSERT OR UPDATE OF amount, user_id ON expense_splits
    FOR EACH ROW EXECUTE FUNCTION emit_expense_split_viewer_delta();

COMMIT;
```

- [ ] **0.4 Apply the migration to dev.** Apply via the `supabase` MCP `apply_migration` (name `activity_expense_viewer_delta`, project `drxfbicunusmipdgbgdk`) with the migration body above. Expect a successful apply (no error returned).

- [ ] **0.5 Run the test again, expect it to PASS.** Re-run the full test file body through `mcp__supabase__execute_sql` against dev `drxfbicunusmipdgbgdk`. Expected: the call succeeds and the server emits the notice —

```
NOTICE:  All activity_expense_viewer_delta tests passed.
```

(No `EXCEPTION`; the transaction ROLLBACKs so nothing persists.)

- [ ] **0.6 Commit the migration + test.**

```bash
git add cost-share-app/supabase/migrations/20260706120000_activity_expense_viewer_delta.sql cost-share-app/supabase/__tests__/activity_expense_viewer_delta.test.sql
git commit -m "feat(activity): store per-recipient viewer_delta on expense_added events

Two-trigger design (expenses seeds the payer delta; expense_splits corrects
each participant to paid-share) so the Activity screen can color expense
amounts by the viewer's net. New events colored; pre-existing rows lack the
field and render black.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **0.7 (Deferred — prod) After the whole plan is verified and the user approves**, apply the same migration to prod `jfqxjjjbpxbwwvoygahu` via the `supabase-prod` MCP `apply_migration`, then re-run the test file body through `mcp__supabase-prod__execute_sql` and confirm the same `All activity_expense_viewer_delta tests passed.` notice. Do NOT apply to prod before approval (per `docs/SSOT/SUPABASE_ENVIRONMENTS.md`).

---

## Task 1 — Shared `viewerAmountTone` helper (pure, unit-tested)

**Files:**
- Create: `cost-share-app/apps/mobile/lib/viewerAmountTone.ts`
- Test: `cost-share-app/apps/mobile/__tests__/lib/viewerAmountTone.test.ts`

Rationale for location: sibling helpers `feedExpensePerspective.ts`, `feedSettlementPerspective.ts`, `activityCardVariant.ts`, `feedAmountLayout.ts` all live in `lib/`. This is presentation-mapping logic (net → tone → class), so `lib/` is the correct home.

- [ ] **1.1 Write the failing test.** Create `cost-share-app/apps/mobile/__tests__/lib/viewerAmountTone.test.ts` with the COMPLETE contents:

```ts
import {
    viewerAmountTone,
    viewerAmountToneClass,
} from '../../lib/viewerAmountTone';

describe('viewerAmountTone', () => {
    it('returns positive when the viewer is owed (net > 0)', () => {
        expect(viewerAmountTone(12.5)).toBe('positive');
        expect(viewerAmountTone(0.01)).toBe('positive');
    });

    it('returns negative when the viewer owes (net < 0)', () => {
        expect(viewerAmountTone(-12.5)).toBe('negative');
        expect(viewerAmountTone(-0.01)).toBe('negative');
    });

    it('returns neutral when net is exactly zero', () => {
        expect(viewerAmountTone(0)).toBe('neutral');
    });

    it('treats sub-cent magnitudes as neutral', () => {
        expect(viewerAmountTone(0.004)).toBe('neutral');
        expect(viewerAmountTone(-0.004)).toBe('neutral');
    });

    it('returns neutral for a non-finite net', () => {
        expect(viewerAmountTone(Number.NaN)).toBe('neutral');
    });
});

describe('viewerAmountToneClass', () => {
    it('maps positive to green', () => {
        expect(viewerAmountToneClass('positive')).toBe('text-green-600');
    });

    it('maps negative to red', () => {
        expect(viewerAmountToneClass('negative')).toBe('text-red-500');
    });

    it('maps neutral to gray-900 (black)', () => {
        expect(viewerAmountToneClass('neutral')).toBe('text-gray-900');
    });
});
```

- [ ] **1.2 Run the test, expect it to fail (module missing).**

```bash
cd cost-share-app/apps/mobile && npx jest __tests__/lib/viewerAmountTone.test.ts --watchman=false
```

Expected output contains:

```
Cannot find module '../../lib/viewerAmountTone' from '__tests__/lib/viewerAmountTone.test.ts'
```

(Test suite fails to run — 0 passed.)

- [ ] **1.3 Write the minimal implementation.** Create `cost-share-app/apps/mobile/lib/viewerAmountTone.ts` with the COMPLETE contents:

```ts
/**
 * Maps a viewer's signed net (in currency units) to a display tone, and the
 * tone to a Tailwind color class. Single source of truth for coloring the main
 * amount text on transaction cards.
 *
 *   net > 0  → viewer is owed   → 'positive' → green
 *   net < 0  → viewer owes      → 'negative' → red
 *   net ~= 0 → settled / N/A    → 'neutral'  → black (gray-900)
 *
 * Green/red classes mirror the existing SummaryBalanceStrip CurrencyChip
 * convention (text-green-600 / text-red-500).
 */

export type ViewerAmountTone = 'positive' | 'negative' | 'neutral';

/** Below this magnitude a net is treated as settled (matches balance UI's 0.01 cutoff). */
const NET_EPSILON = 0.005;

export function viewerAmountTone(net: number): ViewerAmountTone {
    if (!Number.isFinite(net) || Math.abs(net) < NET_EPSILON) return 'neutral';
    return net > 0 ? 'positive' : 'negative';
}

export function viewerAmountToneClass(tone: ViewerAmountTone): string {
    switch (tone) {
        case 'positive':
            return 'text-green-600';
        case 'negative':
            return 'text-red-500';
        case 'neutral':
            return 'text-gray-900';
    }
}
```

- [ ] **1.4 Run the test, expect it to pass.**

```bash
cd cost-share-app/apps/mobile && npx jest __tests__/lib/viewerAmountTone.test.ts --watchman=false
```

Expected: `Tests: 8 passed, 8 total` (5 in first describe, 3 in second).

- [ ] **1.5 Commit.**

```bash
git add cost-share-app/apps/mobile/lib/viewerAmountTone.ts cost-share-app/apps/mobile/__tests__/lib/viewerAmountTone.test.ts
git commit -m "feat(mobile): add viewerAmountTone helper for amount coloring

Pure net→tone→class mapper (green owed / red owing / black neutral),
mirroring the SummaryBalanceStrip green/red convention.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2 — Activity card colors the amount by viewer net (fix settlement-always-green)

> **Depends on Task 0** — the expense coloring reads `metadata.viewer_delta`, which Task 0's migration must have added to dev first. The unit test for the "expense positive/negative" cases passes purely client-side (the test provides `viewer_delta` in the fixture), so the client work can proceed in parallel, but real activity-feed expenses only color once Task 0 is applied.

**Files:**
- Modify: `cost-share-app/apps/mobile/lib/activityCardVariant.ts` (add `activityCardAmountClassForNet`; existing `activityCardAmountClass` at lines 188-197 stays for non-amount tones but the amount now uses the new function)
- Modify: `cost-share-app/apps/mobile/components/ActivityItemCard.tsx` (lines 128-218: compute viewer net, use new class for the amount `Text` at line 204)
- Test: `cost-share-app/apps/mobile/__tests__/components/ActivityItemCard.test.tsx` (existing file; add a new `describe` block)

**Viewer-net rule for the activity card:**
- The feed row belongs to `event.userId` — that is the viewer for this row.
- `settlement_added`: metadata has `to_user_id`/`from_user_id`. `to_user_id === event.userId` ⇒ +amount (green); `from_user_id === event.userId` ⇒ −amount (red); otherwise 0 (black).
- `consolidation_batch_added`: metadata has `paid_to_user_id`/`paid_by_user_id` and `payment_amount`. `paid_to_user_id === event.userId` ⇒ green; `paid_by_user_id === event.userId` ⇒ red; otherwise black.
- `expense_added`: metadata now carries `viewer_delta` (added by Task 0). Use it directly as the signed net: `viewer_delta > 0` ⇒ green, `< 0` ⇒ red, `= 0` or **absent** (pre-Task-0 event) ⇒ black.
- All other kinds don't show an amount.

- [ ] **2.1 Write the failing helper test.** Append to `cost-share-app/apps/mobile/__tests__/lib/activityCardVariant.test.ts` — add this import at the top (change line 1):

```ts
import {
    getActivityCardVariant,
    activityCardAmountClassForNet,
} from '../../lib/activityCardVariant';
```

and append this `describe` block at the end of the file (after the closing `});` of the existing describe):

```ts
describe('activityCardAmountClassForNet', () => {
    it('colors a positive viewer net green', () => {
        expect(activityCardAmountClassForNet(20)).toBe('text-green-600');
    });

    it('colors a negative viewer net red', () => {
        expect(activityCardAmountClassForNet(-20)).toBe('text-red-500');
    });

    it('colors a zero / uninvolved viewer net black', () => {
        expect(activityCardAmountClassForNet(0)).toBe('text-gray-900');
    });
});
```

- [ ] **2.2 Run the test, expect it to fail (export missing).**

```bash
cd cost-share-app/apps/mobile && npx jest __tests__/lib/activityCardVariant.test.ts --watchman=false
```

Expected output contains:

```
TypeError: (0 , _activityCardVariant.activityCardAmountClassForNet) is not a function
```

(The 3 new tests fail; the pre-existing `getActivityCardVariant` tests still pass.)

- [ ] **2.3 Implement `activityCardAmountClassForNet`.** In `cost-share-app/apps/mobile/lib/activityCardVariant.ts`, change the import block at the top (lines 6-8) from:

```ts
import type { ActivityEventKind } from '@cost-share/shared';
import type { AppIconName } from '../components/AppIcon';
import { colors } from '../theme';
```

to:

```ts
import type { ActivityEventKind } from '@cost-share/shared';
import type { AppIconName } from '../components/AppIcon';
import { colors } from '../theme';
import { viewerAmountTone, viewerAmountToneClass } from './viewerAmountTone';
```

Then append this function at the end of the file (after `activityCardAmountClass`, i.e. after line 197):

```ts
/**
 * Color for the activity card's main amount, keyed off the VIEWER's signed net
 * (green owed / red owing / black neutral) rather than the card type. This
 * replaces the old type-keyed coloring where every settlement was green.
 */
export function activityCardAmountClassForNet(net: number): string {
    return viewerAmountToneClass(viewerAmountTone(net));
}
```

- [ ] **2.4 Run the helper test, expect it to pass.**

```bash
cd cost-share-app/apps/mobile && npx jest __tests__/lib/activityCardVariant.test.ts --watchman=false
```

Expected: `Tests: 11 passed, 11 total` (8 pre-existing + 3 new).

- [ ] **2.5 Commit the helper.**

```bash
git add cost-share-app/apps/mobile/lib/activityCardVariant.ts cost-share-app/apps/mobile/__tests__/lib/activityCardVariant.test.ts
git commit -m "feat(mobile): add activityCardAmountClassForNet (viewer-net color)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **2.6 Write the failing card-render test.** In `cost-share-app/apps/mobile/__tests__/components/ActivityItemCard.test.tsx`, append this new `describe` block at the end of the file (after the final closing `});`). It relies on the existing `buildEvent` helper. Note `buildEvent` defaults `userId: 'u-recipient'` — that is the viewer for the row.

```ts
describe('ActivityItemCard — amount color by viewer net', () => {
    it('colors the settlement amount green when the viewer is the payee', () => {
        const { getByText } = render(
            <ActivityItemCard
                event={buildEvent('settlement_added', {
                    userId: 'u-recipient',
                    metadata: {
                        from_user_id: 'u-payer',
                        to_user_id: 'u-recipient',
                        amount: 20,
                        currency: 'USD',
                    },
                })}
                title="Bob paid you"
                meta="now"
                testID="card"
            />,
        );
        const amount = getByText(/\$20/);
        expect(amount.props.className).toContain('text-green-600');
    });

    it('colors the settlement amount red when the viewer is the payer', () => {
        const { getByText } = render(
            <ActivityItemCard
                event={buildEvent('settlement_added', {
                    userId: 'u-recipient',
                    metadata: {
                        from_user_id: 'u-recipient',
                        to_user_id: 'u-payee',
                        amount: 20,
                        currency: 'USD',
                    },
                })}
                title="You paid Bob"
                meta="now"
                testID="card"
            />,
        );
        const amount = getByText(/\$20/);
        expect(amount.props.className).toContain('text-red-500');
    });

    it('colors a third-party settlement amount black', () => {
        const { getByText } = render(
            <ActivityItemCard
                event={buildEvent('settlement_added', {
                    userId: 'u-recipient',
                    metadata: {
                        from_user_id: 'u-a',
                        to_user_id: 'u-b',
                        amount: 20,
                        currency: 'USD',
                    },
                })}
                title="Alice paid Bob"
                meta="now"
                testID="card"
            />,
        );
        const amount = getByText(/\$20/);
        expect(amount.props.className).toContain('text-gray-900');
    });

    it('colors an expense amount green when the viewer_delta is positive (viewer is owed)', () => {
        const { getByText } = render(
            <ActivityItemCard
                event={buildEvent('expense_added', {
                    userId: 'u-recipient',
                    metadata: {
                        description: 'Dinner',
                        amount: 30,
                        currency: 'USD',
                        viewer_delta: 20,
                    },
                })}
                title="Dinner"
                meta="Alice · now"
                groupName="Trip"
                testID="card"
            />,
        );
        const amount = getByText(/\$30/);
        expect(amount.props.className).toContain('text-green-600');
    });

    it('colors an expense amount red when the viewer_delta is negative (viewer owes)', () => {
        const { getByText } = render(
            <ActivityItemCard
                event={buildEvent('expense_added', {
                    userId: 'u-recipient',
                    metadata: {
                        description: 'Dinner',
                        amount: 30,
                        currency: 'USD',
                        viewer_delta: -10,
                    },
                })}
                title="Dinner"
                meta="Alice · now"
                groupName="Trip"
                testID="card"
            />,
        );
        const amount = getByText(/\$30/);
        expect(amount.props.className).toContain('text-red-500');
    });

    it('colors an expense amount black when viewer_delta is absent (pre-Task-0 event)', () => {
        const { getByText } = render(
            <ActivityItemCard
                event={buildEvent('expense_added', {
                    userId: 'u-recipient',
                    metadata: { description: 'Coffee', amount: 5.5, currency: 'USD' },
                })}
                title="Coffee"
                meta="Alice · now"
                groupName="Trip"
                testID="card"
            />,
        );
        const amount = getByText(/\$5\.50/);
        expect(amount.props.className).toContain('text-gray-900');
    });

    it('colors the consolidation batch amount green when the viewer is the payee', () => {
        const { getByText } = render(
            <ActivityItemCard
                event={buildEvent('consolidation_batch_added', {
                    userId: 'u-recipient',
                    metadata: {
                        paid_by_user_id: 'u-payer',
                        paid_to_user_id: 'u-recipient',
                        payment_amount: 150,
                        payment_currency: 'ILS',
                    },
                })}
                title="Avi paid you"
                meta="now"
                testID="card"
            />,
        );
        const amount = getByText(/₪150/);
        expect(amount.props.className).toContain('text-green-600');
    });
});
```

- [ ] **2.7 Run the card test, expect it to fail (amount still type-colored).**

```bash
cd cost-share-app/apps/mobile && npx jest __tests__/components/ActivityItemCard.test.tsx --watchman=false
```

Expected: several of the 7 new color-assertion tests FAIL because the amount currently uses `activityCardAmountClass(variant.amountTone)` — a type-keyed color, not a viewer-net one. Settlements/consolidations render `text-green-600` (so the "payee → green" cases may pass by luck), but the "payer → red", "third-party → black", "expense positive → green", and "expense negative → red" cases FAIL because the current code ignores `viewer_delta` and signs. Expected failure excerpt for the payer case:

```
expect(received).toContain(expected)
Expected substring: "text-red-500"
Received string:    "...text-green-600..."
```

(At minimum the "settlement payer → red", "third-party settlement → black", "expense positive → green", and "expense negative → red" assertions fail; the "expense absent → black" case renders `text-gray-900` via the `default` tone so it already passes.)

- [ ] **2.8 Implement viewer-net coloring in `ActivityItemCard.tsx`.** Change the import at lines 14-17 from:

```ts
import {
    activityCardAmountClass,
    getActivityCardVariant,
} from '../lib/activityCardVariant';
```

to:

```ts
import {
    activityCardAmountClassForNet,
    getActivityCardVariant,
} from '../lib/activityCardVariant';
```

Then, immediately after the `amountText` line (currently line 150 `const amountText = showAmount ? formatCurrencyAmount(amount, currency) : null;`), insert the viewer-net computation:

```ts
    // Viewer net for amount color. The feed row belongs to event.userId (the
    // viewer). Expenses carry the viewer's signed net directly in metadata
    // (viewer_delta = paid − share, added by the Task 0 migration); rows created
    // before that migration have no viewer_delta → net 0 → black. Settlements/
    // consolidations carry the parties, so we sign the amount from the viewer's
    // perspective.
    const viewerId = event.userId;
    let amountNet = 0;
    if (event.kind === 'expense_added') {
        amountNet =
            typeof md.viewer_delta === 'number' || typeof md.viewer_delta === 'string'
                ? Number(md.viewer_delta)
                : 0;
    } else if (event.kind === 'settlement_added') {
        if (md.to_user_id === viewerId) amountNet = amount;
        else if (md.from_user_id === viewerId) amountNet = -amount;
    } else if (event.kind === 'consolidation_batch_added') {
        if (md.paid_to_user_id === viewerId) amountNet = amount;
        else if (md.paid_by_user_id === viewerId) amountNet = -amount;
    }
    const amountColorClass = activityCardAmountClassForNet(amountNet);
```

Then change the amount `Text` className at line 204 from:

```tsx
                        className={`text-[15px] font-bold ${activityCardAmountClass(variant.amountTone)}`}
```

to:

```tsx
                        className={`text-[15px] font-bold ${amountColorClass}`}
```

> Note: `amount` here is the numeric already parsed at lines 143-146, and `md` is `event.metadata ?? {}` from line 142. `variant.amountTone` and the old `activityCardAmountClass` are no longer referenced by `ActivityItemCard`; leave `activityCardAmountClass` exported in `activityCardVariant.ts` (still covered by its own module and unused-but-harmless) — do not delete it in this task to keep the diff minimal and avoid touching unrelated consumers. (Verify no other importer with: `grep -rn "activityCardAmountClass\b" cost-share-app/apps/mobile --include=*.tsx --include=*.ts` — expect only the definition remains.)

- [ ] **2.9 Run the card test, expect it to pass.**

```bash
cd cost-share-app/apps/mobile && npx jest __tests__/components/ActivityItemCard.test.tsx --watchman=false
```

Expected: all tests pass (pre-existing + 7 new), e.g. `Tests: 30 passed, 30 total` (23 pre-existing + 7 new — confirm the count from the run; the exact pre-existing count is whatever the file currently has).

- [ ] **2.10 Commit.**

```bash
git add cost-share-app/apps/mobile/components/ActivityItemCard.tsx cost-share-app/apps/mobile/__tests__/components/ActivityItemCard.test.tsx
git commit -m "fix(mobile): color activity amount by viewer net (settlements no longer always green)

Settlement/consolidation amounts now render green when the viewer is the
payee, red when the payer, black for third parties. Expense amounts render
green/red from metadata.viewer_delta (Task 0); pre-migration events lack the
field and stay black.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3 — Group screen: `FeedRowCard` accepts an amount color; `ExpenseRow` & `SettlementRow` pass viewer tone

**Files:**
- Modify: `cost-share-app/apps/mobile/components/FeedRowCard.tsx` (props at lines 112-120; amount `FeedAmountLine` at lines 157-160)
- Test: `cost-share-app/apps/mobile/__tests__/components/FeedRowCard.test.tsx`
- Modify: `cost-share-app/apps/mobile/components/ExpenseRow.tsx` (lines 50-109)
- Test: `cost-share-app/apps/mobile/__tests__/components/ExpenseRow.test.tsx`
- Modify: `cost-share-app/apps/mobile/components/SettlementRow.tsx` (lines 29-65)
- Test: `cost-share-app/apps/mobile/__tests__/components/SettlementRow.test.tsx`

### 3a — `FeedRowCard` amountClassName plumbing

- [ ] **3a.1 Write the failing FeedRowCard test.** In `cost-share-app/apps/mobile/__tests__/components/FeedRowCard.test.tsx`, append this test inside the existing `describe('FeedRowCard', ...)` block (before its closing `});` at line 75). The amount is split by `FeedAmountLine` into a `currency` Text and a `value` Text — both receive `className`, so assert on the value Text:

```ts
  it('applies amountClassName to the amount when provided', () => {
    const { getByText } = render(
      <FeedRowCard {...baseProps} amountClassName="text-green-600" />,
    );
    const value = getByText('84.20');
    expect(value.props.className).toContain('text-green-600');
  });

  it('defaults the amount to text-gray-900 when no amountClassName is given', () => {
    const { getByText } = render(<FeedRowCard {...baseProps} />);
    const value = getByText('84.20');
    expect(value.props.className).toContain('text-gray-900');
  });
```

- [ ] **3a.2 Run the test, expect it to fail.**

```bash
cd cost-share-app/apps/mobile && npx jest __tests__/components/FeedRowCard.test.tsx --watchman=false
```

Expected: the first new test fails because `amountClassName` is ignored and the value renders `text-gray-900` (the hardcoded class at line 159):

```
expect(received).toContain(expected)
Expected substring: "text-green-600"
Received string:    "text-[15px] font-bold text-gray-900 ..."
```

(The second new test — default gray — passes already.)

- [ ] **3a.3 Implement `amountClassName` in `FeedRowCard.tsx`.** Change the props interface (lines 112-120) from:

```ts
interface FeedRowCardProps {
    thumbnail: React.ReactNode;
    title: string;
    meta: string;
    amount: string;
    subLine?: React.ReactNode;
    onPress?: () => void;
    testID?: string;
}
```

to:

```ts
interface FeedRowCardProps {
    thumbnail: React.ReactNode;
    title: string;
    meta: string;
    amount: string;
    /** Tailwind color class for the main amount (viewer-net tone). Defaults to black. */
    amountClassName?: string;
    subLine?: React.ReactNode;
    onPress?: () => void;
    testID?: string;
}
```

Change the destructure (lines 122-130) from:

```ts
export function FeedRowCard({
    thumbnail,
    title,
    meta,
    amount,
    subLine,
    onPress,
    testID,
}: FeedRowCardProps) {
```

to:

```ts
export function FeedRowCard({
    thumbnail,
    title,
    meta,
    amount,
    amountClassName = 'text-gray-900',
    subLine,
    onPress,
    testID,
}: FeedRowCardProps) {
```

Change the amount `FeedAmountLine` (lines 157-160) from:

```tsx
                <FeedAmountLine
                    amount={amount}
                    className="text-[15px] font-bold text-gray-900"
                />
```

to:

```tsx
                <FeedAmountLine
                    amount={amount}
                    className={`text-[15px] font-bold ${amountClassName}`}
                />
```

- [ ] **3a.4 Run the test, expect it to pass.**

```bash
cd cost-share-app/apps/mobile && npx jest __tests__/components/FeedRowCard.test.tsx --watchman=false
```

Expected: all pass, e.g. `Tests: 7 passed, 7 total` (5 pre-existing + 2 new).

- [ ] **3a.5 Commit.**

```bash
git add cost-share-app/apps/mobile/components/FeedRowCard.tsx cost-share-app/apps/mobile/__tests__/components/FeedRowCard.test.tsx
git commit -m "feat(mobile): FeedRowCard accepts amountClassName (default black)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### 3b — `ExpenseRow` passes viewer tone

- [ ] **3b.1 Write the failing ExpenseRow test.** In `cost-share-app/apps/mobile/__tests__/components/ExpenseRow.test.tsx`, append these tests inside the existing `describe('ExpenseRow', ...)` block (before its closing `});` at line 114). The `baseExpense` fixture is `myDeltaState: 'lent'`, `myDelta: 20`, amount `30`, currency `USD`; `FeedAmountLine` renders the value `30.00` as a separate Text:

```ts
    it('colors the amount green when the viewer lent (is owed)', () => {
        const { getByText } = render(
            <ExpenseRow
                expense={baseExpense}
                currentUserId="me"
                payerName="Alice"
                onPress={() => {}}
            />,
        );
        const value = getByText('30.00');
        expect(value.props.className).toContain('text-green-600');
    });

    it('colors the amount red when the viewer borrowed (owes)', () => {
        const { getByText } = render(
            <ExpenseRow
                expense={{ ...baseExpense, myDelta: -10, myDeltaState: 'borrowed' }}
                currentUserId="me"
                payerName="Alice"
                onPress={() => {}}
            />,
        );
        const value = getByText('30.00');
        expect(value.props.className).toContain('text-red-500');
    });

    it('colors the amount black when settled / not involved', () => {
        const { getByText } = render(
            <ExpenseRow
                expense={{ ...baseExpense, myDelta: 0, myDeltaState: 'settled' }}
                currentUserId="me"
                payerName="Alice"
                onPress={() => {}}
            />,
        );
        const value = getByText('30.00');
        expect(value.props.className).toContain('text-gray-900');
    });
```

- [ ] **3b.2 Run the test, expect it to fail.**

```bash
cd cost-share-app/apps/mobile && npx jest __tests__/components/ExpenseRow.test.tsx --watchman=false
```

Expected: the lent (green) and borrowed (red) tests fail because the amount still renders the default `text-gray-900`:

```
expect(received).toContain(expected)
Expected substring: "text-green-600"
Received string:    "text-[15px] font-bold text-gray-900 ..."
```

(The settled → black test passes already.)

- [ ] **3b.3 Implement the tone in `ExpenseRow.tsx`.** Add the helper import — change the import block (lines 20-24) from:

```ts
import {
    resolveExpenseFeedPerspective,
    expenseFeedSummaryKey,
    expenseFeedSummaryCount,
} from '../lib/feedExpensePerspective';
```

to:

```ts
import {
    resolveExpenseFeedPerspective,
    expenseFeedSummaryKey,
    expenseFeedSummaryCount,
} from '../lib/feedExpensePerspective';
import { viewerAmountToneClass } from '../lib/viewerAmountTone';
```

Then, right before the `return (` of `ExpenseRowBase` (currently line 99), add the tone derivation. `myDeltaState`/`myDelta` are the canonical viewer direction already used for the sub-line above:

```ts
    // Amount color mirrors the borrowed/lent sub-line, which is the canonical
    // viewer direction: lent ⇒ owed (green), borrowed ⇒ owes (red), else black.
    const amountClassName = viewerAmountToneClass(
        userShare > 0
            ? (expense.myDeltaState === 'lent' ? 'positive' : 'negative')
            : 'neutral',
    );
```

Then pass it to `FeedRowCard` — change the JSX (lines 100-108) from:

```tsx
        <FeedRowCard
            thumbnail={thumbnail}
            title={expense.description}
            meta={meta}
            amount={amount}
            subLine={subLine}
            onPress={() => onPress(expense.id)}
            testID={`expense-row-${expense.id}`}
        />
```

to:

```tsx
        <FeedRowCard
            thumbnail={thumbnail}
            title={expense.description}
            meta={meta}
            amount={amount}
            amountClassName={amountClassName}
            subLine={subLine}
            onPress={() => onPress(expense.id)}
            testID={`expense-row-${expense.id}`}
        />
```

> `userShare` is already declared at line 70 (`const userShare = Math.abs(expense.myDelta);`) above the sub-line block, so it is in scope for the tone derivation. Using `userShare > 0` keeps color and sub-line in lockstep: when there's no involvement the row shows no sub-line and the amount is black.

- [ ] **3b.4 Run the test, expect it to pass.**

```bash
cd cost-share-app/apps/mobile && npx jest __tests__/components/ExpenseRow.test.tsx --watchman=false
```

Expected: all pass, e.g. `Tests: 9 passed, 9 total` (6 pre-existing + 3 new).

- [ ] **3b.5 Commit.**

```bash
git add cost-share-app/apps/mobile/components/ExpenseRow.tsx cost-share-app/apps/mobile/__tests__/components/ExpenseRow.test.tsx
git commit -m "feat(mobile): color group-feed expense amount by viewer net (lent/borrowed)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### 3c — `SettlementRow` passes viewer tone

- [ ] **3c.1 Write the failing SettlementRow test.** In `cost-share-app/apps/mobile/__tests__/components/SettlementRow.test.tsx`, append these tests inside the existing `describe('SettlementRow', ...)` block (before its closing `});` at line 46). The `settlement` fixture is `fromUserId: 'me'`, `toUserId: 'bob'`, amount `50`, currency `ILS`; `FeedAmountLine` renders the value `50.00`:

```ts
    it('colors the amount red when the viewer paid (is the payer)', () => {
        const { getByText } = render(
            <SettlementRow
                settlement={settlement}
                currentUserId="me"
                fromName="את/ה"
                toName="Bob"
                onPress={() => {}}
            />,
        );
        const value = getByText('50.00');
        expect(value.props.className).toContain('text-red-500');
    });

    it('colors the amount green when the viewer was paid (is the payee)', () => {
        const { getByText } = render(
            <SettlementRow
                settlement={settlement}
                currentUserId="bob"
                fromName="Me"
                toName="את/ה"
                onPress={() => {}}
            />,
        );
        const value = getByText('50.00');
        expect(value.props.className).toContain('text-green-600');
    });

    it('colors the amount black for a third-party settlement', () => {
        const { getByText } = render(
            <SettlementRow
                settlement={settlement}
                currentUserId="carol"
                fromName="Me"
                toName="Bob"
                onPress={() => {}}
            />,
        );
        const value = getByText('50.00');
        expect(value.props.className).toContain('text-gray-900');
    });
```

- [ ] **3c.2 Run the test, expect it to fail.**

```bash
cd cost-share-app/apps/mobile && npx jest __tests__/components/SettlementRow.test.tsx --watchman=false
```

Expected: the payer (red) and payee (green) tests fail because the amount still renders `text-gray-900` (FeedRowCard default):

```
expect(received).toContain(expected)
Expected substring: "text-red-500"
Received string:    "text-[15px] font-bold text-gray-900 ..."
```

(The third-party → black test passes already.)

- [ ] **3c.3 Implement the tone in `SettlementRow.tsx`.** Add the helper import — change the import block (lines 14-15) from:

```ts
import { buildSettlementFeedCopy } from '../lib/feedSettlementPerspective';
import { colors } from '../theme';
```

to:

```ts
import { buildSettlementFeedCopy } from '../lib/feedSettlementPerspective';
import { viewerAmountToneClass } from '../lib/viewerAmountTone';
import { colors } from '../theme';
```

Then, right after the `amount` line (currently line 46 `const amount = ...`), add the tone derivation from `fromUserId`/`toUserId`:

```ts
    // Payee ⇒ +amount (green), payer ⇒ −amount (red), otherwise black.
    const amountClassName = viewerAmountToneClass(
        settlement.toUserId === currentUserId
            ? 'positive'
            : settlement.fromUserId === currentUserId
                ? 'negative'
                : 'neutral',
    );
```

Then pass it to `FeedRowCard` — change the JSX (lines 57-64) from:

```tsx
        <FeedRowCard
            thumbnail={thumbnail}
            title={title}
            meta={meta}
            amount={amount}
            onPress={onPress}
            testID={`settlement-press-${settlement.id}`}
        />
```

to:

```tsx
        <FeedRowCard
            thumbnail={thumbnail}
            title={title}
            meta={meta}
            amount={amount}
            amountClassName={amountClassName}
            onPress={onPress}
            testID={`settlement-press-${settlement.id}`}
        />
```

- [ ] **3c.4 Run the test, expect it to pass.**

```bash
cd cost-share-app/apps/mobile && npx jest __tests__/components/SettlementRow.test.tsx --watchman=false
```

Expected: all pass, e.g. `Tests: 5 passed, 5 total` (2 pre-existing + 3 new).

- [ ] **3c.5 Commit.**

```bash
git add cost-share-app/apps/mobile/components/SettlementRow.tsx cost-share-app/apps/mobile/__tests__/components/SettlementRow.test.tsx
git commit -m "feat(mobile): color group-feed settlement amount by viewer net (payer/payee)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4 — Full-suite verification

**Files:** none (verification only).

- [ ] **4.1 Run the full affected test set together.**

```bash
cd cost-share-app/apps/mobile && npx jest \
  __tests__/lib/viewerAmountTone.test.ts \
  __tests__/lib/activityCardVariant.test.ts \
  __tests__/components/ActivityItemCard.test.tsx \
  __tests__/components/FeedRowCard.test.tsx \
  __tests__/components/ExpenseRow.test.tsx \
  __tests__/components/SettlementRow.test.tsx \
  --watchman=false
```

Expected: `Test Suites: 6 passed, 6 total`, all tests green.

- [ ] **4.2 Typecheck the mobile app** (catches prop/type drift across the three components):

```bash
cd cost-share-app/apps/mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **4.3 Confirm no stray references** to the removed amount-color path in the activity card:

```bash
grep -rn "activityCardAmountClass\b" cost-share-app/apps/mobile --include=*.tsx --include=*.ts
```

Expected: only the definition line in `lib/activityCardVariant.ts` (no remaining callers). If a caller still exists outside this plan's scope, do not delete the function.

- [ ] **4.4 Re-run the backend SQL regression test on dev** (guards the `viewer_delta` triggers against later drift):

Run the full body of `cost-share-app/supabase/__tests__/activity_expense_viewer_delta.test.sql` through `mcp__supabase__execute_sql` against dev `drxfbicunusmipdgbgdk`.

Expected: `NOTICE:  All activity_expense_viewer_delta tests passed.` (no `EXCEPTION`; transaction ROLLBACKs).

---

## Open questions / risks

1. **Activity-feed expenses are colored via a new `viewer_delta` metadata field; pre-existing events stay black (accepted).** Task 0 extends the `expense_added` fan-out so each recipient row carries `metadata.viewer_delta` (paid − share). New events are colored green/red/black by that signed net. Rows created before the Task 0 migration — including the 12-month backfill from `20260526105507_activity_events.sql` and any events written between now and the migration apply — have no `viewer_delta` and render **black**. Product has accepted this (no backfill of `viewer_delta` for old rows). If colored history is later wanted, a one-off backfill UPDATE joining `activity_events → expenses → expense_splits` on `(ref_id, user_id)` would fill it in.

   1a. **Splits are NOT available when the `AFTER INSERT ON expenses` trigger fires.** `create_expense_with_splits` inserts the expense (firing the trigger) before the splits. Empirically confirmed on dev: a probe trigger sees 0 split rows. This is why Task 0 uses **two** triggers — the expense-side trigger can only seed the payer's `+amount`; the `expense_splits` trigger fills each participant's `paid − share`. If a future code path inserts splits *before* the expense, the split trigger's `SELECT ... FROM expenses` would find no row and no-op (the row simply keeps the payer-seeded delta) — acceptable, and no known path does this. Expenses are created exclusively via the `create_expense_with_splits` RPC (application code), not by a splits-first path.

   1b. **Multi-currency is not a concern within one expense.** `expenses.currency` is a single column, so `viewer_delta` is unambiguously in that currency. There is no cross-currency mixing inside a single expense card. (Cross-group feed cards each still carry their own `currency`.)

   1c. **Edit path.** The Task-0 expense-side edit branch (`ELSIF ... OLD.amount IS DISTINCT FROM NEW.amount ...`) recomputes `viewer_delta` per row as `(user = paid_by ? new amount : 0) − existing split` via a correlated subquery on `expense_splits`, so an amount/payer edit re-colors correctly even without a split row changing. If the *splits* change on edit, the `expense_splits` UPDATE trigger (fires on `UPDATE OF amount, user_id`) re-applies the share. The Group screen already re-derives from `myDelta`, so it's unaffected.

2. **Class vs. hex convention.** `SummaryBalanceStrip` uses two conventions: `colors.success.text`/`colors.error` hex for the inline sentence, and `text-green-600`/`text-red-500` Tailwind classes for the `CurrencyChip`. This plan uses the **Tailwind classes** for the amount `Text` because (a) the amount is already styled via `className`, and (b) every existing test asserts on `.props.className`. Note `text-green-600` (`#16A34A`) is a slightly brighter green than the spec's `colors.success.text` (`#047857`); if product insists on the exact `#047857`, switch `viewerAmountToneClass('positive')` to return an inline color instead — but that would require changing the assertion style and the `FeedAmountLine`/`ActivityItemCard` amount `Text` to accept a `style` color. Recommend confirming the green shade with the designer; the plan as written favors consistency with the existing `CurrencyChip`.

3. **`event.userId` as viewer id.** The activity coloring relies on `ActivityEvent.userId` being the feed-row owner (the viewer). This holds because `activity_events` is a per-user fan-out table (one row per recipient; see the `SELECT gm.user_id ... FROM group_members gm` inserts). If that model ever changes to a shared feed, the activity card would need an explicit `currentUserId` prop instead. Low risk today.

4. **Pre-existing test counts are indicative.** The `Tests: N passed` totals above note the pre-existing counts as observed while writing this plan; the implementing agent should trust the actual run output rather than the exact numbers if the suites have drifted.
