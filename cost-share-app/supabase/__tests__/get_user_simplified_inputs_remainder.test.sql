-- ============================================================================
-- Regression test: get_user_simplified_inputs() must SELF-HEAL an expense whose
-- splits don't cover its amount, by attributing the unsplit remainder to the
-- payer (paid_by) — "what you didn't split, you consumed yourself".
--
-- This guarantees the per-currency ledger always sums to zero, so a corrupt /
-- legacy expense can never produce an UnbalancedLedgerError that the UI would
-- have to surface as "data problem". The user never sees an error; the numbers
-- are simply correct.
--
-- Run via Supabase MCP (mcp__supabase__execute_sql) against dev
-- drxfbicunusmipdgbgdk. Wrapped in BEGIN/ROLLBACK — no data persists.
-- ============================================================================

BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_group   CONSTANT UUID := '00000000-0000-0000-0000-0000005217e0';
    v_a       CONSTANT UUID := '00000000-0000-0000-0000-0000005217a1'; -- payer (caller)
    v_b       CONSTANT UUID := '00000000-0000-0000-0000-0000005217b2'; -- member
    v_expense CONSTANT UUID := '00000000-0000-0000-0000-0000005217e1';
    v_sum   NUMERIC;
    v_a_net NUMERIC;
    v_b_net NUMERIC;
    v_payload JSONB;
BEGIN
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token) VALUES
        (v_a, 'Ari', 'ILS', TRUE, 'tt_rem_a'),
        (v_b, 'Bar', 'ILS', TRUE, 'tt_rem_b');

    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'REM test', 'ILS', TRUE, v_a, 'tt_rem_grp');

    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_a, TRUE),
        (v_group, v_b, TRUE);

    -- A paid 30 ILS but only 20 was split (A=10, B=10). Remainder = 10 unsplit.
    INSERT INTO public.expenses (id, group_id, description, amount, currency, paid_by, created_by, is_deleted)
        VALUES (v_expense, v_group, 'partial', 30, 'ILS', v_a, v_a, FALSE);
    INSERT INTO public.expense_splits (expense_id, user_id, amount) VALUES
        (v_expense, v_a, 10),
        (v_expense, v_b, 10);

    -- Expected after self-heal: A absorbs the 10 remainder → A owes 20 total,
    -- paid 30 → net +10; B net -10; sum 0.

    v_payload := public.get_user_simplified_inputs(v_a);

    SELECT COALESCE(SUM((n->>'net')::numeric), 0) INTO v_sum
      FROM jsonb_array_elements(v_payload->'groups') grp,
           jsonb_array_elements(grp->'currencies') cur,
           jsonb_array_elements(cur->'nets') n
     WHERE grp->>'groupId' = v_group::text AND cur->>'currency' = 'ILS';

    SELECT (n->>'net')::numeric INTO v_a_net
      FROM jsonb_array_elements(v_payload->'groups') grp,
           jsonb_array_elements(grp->'currencies') cur,
           jsonb_array_elements(cur->'nets') n
     WHERE grp->>'groupId' = v_group::text AND cur->>'currency' = 'ILS' AND n->>'userId' = v_a::text;

    SELECT (n->>'net')::numeric INTO v_b_net
      FROM jsonb_array_elements(v_payload->'groups') grp,
           jsonb_array_elements(grp->'currencies') cur,
           jsonb_array_elements(cur->'nets') n
     WHERE grp->>'groupId' = v_group::text AND cur->>'currency' = 'ILS' AND n->>'userId' = v_b::text;

    IF v_sum <> 0 THEN
        RAISE EXCEPTION 'Case A failed: ledger must balance after payer absorbs remainder, got %', v_sum;
    END IF;
    IF v_a_net <> 10 THEN
        RAISE EXCEPTION 'Case B failed: payer A net should be +10 (B owes A), got %', v_a_net;
    END IF;
    IF v_b_net <> -10 THEN
        RAISE EXCEPTION 'Case C failed: B net should be -10, got %', v_b_net;
    END IF;

    RAISE NOTICE 'get_user_simplified_inputs_remainder.test.sql — all cases passed';
END;
$outer$;

ROLLBACK;
