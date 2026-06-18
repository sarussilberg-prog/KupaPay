-- ============================================================================
-- Regression test: get_user_simplified_inputs() must emit a net row for EVERY
-- user with financial footprint in a group — INCLUDING members who are no
-- longer active (left / removed / deleted-account who stays as an inactive
-- member with name = NULL).
--
-- Dropping a footprint user's net makes the per-currency ledger fail to sum to
-- zero. The canonical simplifier (deriveSimplifiedDebts) then throws
-- UnbalancedLedgerError and skips the currency, so every surface shows
-- "everyone settled" while a real debt still exists. This is the root cause of
-- the "you are owed 37.14 / all settled" contradiction.
--
-- Run via Supabase MCP (mcp__supabase__execute_sql) against dev
-- drxfbicunusmipdgbgdk. Wrapped in BEGIN/ROLLBACK — no data persists.
-- ============================================================================

BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_group   CONSTANT UUID := '00000000-0000-0000-0000-0000005117e0';
    v_a       CONSTANT UUID := '00000000-0000-0000-0000-0000005117a1'; -- active payer (the caller)
    v_b       CONSTANT UUID := '00000000-0000-0000-0000-0000005117b2'; -- active member
    v_c       CONSTANT UUID := '00000000-0000-0000-0000-0000005117c3'; -- deleted account: inactive member, NULL name, leftover split
    v_expense CONSTANT UUID := '00000000-0000-0000-0000-0000005117e1';
    v_sum         NUMERIC;
    v_count       INT;
    v_c_net       NUMERIC;
    v_c_in_members BOOLEAN;
    v_payload     JSONB;
BEGIN
    -- ---- seed profiles (C is a deleted account: name NULL, profile inactive) ----
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token) VALUES
        (v_a, 'Ari', 'ILS', TRUE,  'tt_si_a'),
        (v_b, 'Bar', 'ILS', TRUE,  'tt_si_b'),
        (v_c, NULL,  'ILS', FALSE, 'tt_si_c');

    -- ---- seed group ----------------------------------------------------
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'SI test', 'ILS', TRUE, v_a, 'tt_si_grp');

    -- A,B active; C is an inactive member (deleted account) whose split remains
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_a, TRUE),
        (v_group, v_b, TRUE),
        (v_group, v_c, FALSE);

    -- ---- expense: A paid 30 ILS, split 10/10/10 across A, B, C ----------
    INSERT INTO public.expenses (id, group_id, description, amount, currency, paid_by, created_by, is_deleted)
        VALUES (v_expense, v_group, 'dinner', 30, 'ILS', v_a, v_a, FALSE);
    INSERT INTO public.expense_splits (expense_id, user_id, amount) VALUES
        (v_expense, v_a, 10),
        (v_expense, v_b, 10),
        (v_expense, v_c, 10);

    -- Expected ILS nets: A +20, B -10, C -10  → sum 0 (only if C is included).

    v_payload := public.get_user_simplified_inputs(v_a);

    SELECT COALESCE(SUM((n->>'net')::numeric), 0), COUNT(*)
      INTO v_sum, v_count
      FROM jsonb_array_elements(v_payload->'groups') grp,
           jsonb_array_elements(grp->'currencies') cur,
           jsonb_array_elements(cur->'nets') n
     WHERE grp->>'groupId' = v_group::text AND cur->>'currency' = 'ILS';

    SELECT (n->>'net')::numeric INTO v_c_net
      FROM jsonb_array_elements(v_payload->'groups') grp,
           jsonb_array_elements(grp->'currencies') cur,
           jsonb_array_elements(cur->'nets') n
     WHERE grp->>'groupId' = v_group::text AND cur->>'currency' = 'ILS'
       AND n->>'userId' = v_c::text;

    -- Deleted member appears in members[] with a NULL name (client renders
    -- "משתמש שנמחק" from the null).
    SELECT EXISTS(
        SELECT 1 FROM jsonb_array_elements(v_payload->'groups') grp,
                      jsonb_array_elements(grp->'members') m
         WHERE grp->>'groupId' = v_group::text
           AND m->>'userId' = v_c::text
           AND (m->>'name') IS NULL
    ) INTO v_c_in_members;

    -- ---- assertions ----------------------------------------------------
    IF v_count <> 3 THEN
        RAISE EXCEPTION 'Case A failed: expected 3 net rows (incl deleted member C), got %', v_count;
    END IF;
    IF v_sum <> 0 THEN
        RAISE EXCEPTION 'Case B failed: per-currency nets must sum to 0, got % (footprint user dropped)', v_sum;
    END IF;
    IF v_c_net IS DISTINCT FROM -10 THEN
        RAISE EXCEPTION 'Case C failed: deleted member C net should be -10, got %', v_c_net;
    END IF;
    IF NOT v_c_in_members THEN
        RAISE EXCEPTION 'Case D failed: deleted member C must be in members[] with a NULL name';
    END IF;

    RAISE NOTICE 'get_user_simplified_inputs.test.sql — all cases passed';
END;
$outer$;

ROLLBACK;
