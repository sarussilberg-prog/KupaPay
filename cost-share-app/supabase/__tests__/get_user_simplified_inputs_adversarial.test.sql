-- ============================================================================
-- Adversarial regression tests for get_user_simplified_inputs() — locks the
-- "self-healing" debt ledger behaviour from PR #24 against edge cases that the
-- two happy-path tests (footprint + basic remainder) don't cover.
--
-- Invariant under test: for EVERY (group, currency) the emitted per-user nets
-- sum to exactly 0, and the payer absorbs any unsplit/over-split remainder so a
-- corrupt or legacy expense never (a) fabricates debt against a non-payer or
-- (b) produces an UnbalancedLedgerError the UI would have to surface.
--
-- Run each block via Supabase MCP (mcp__supabase__execute_sql) against dev
-- drxfbicunusmipdgbgdk. Every block is BEGIN/ROLLBACK — no data persists.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- CASE 1 — OVER-SPLIT (Σsplits > amount). The payer absorbs the NEGATIVE
-- remainder (i.e. is credited the excess). Ledger must still net to zero.
--   amount 30, paid by A, splits A=20 / B=20 (Σ=40, remainder = -10 -> A)
--   => A = 30 - 20 - (-10) = +20 ; B = -20 ; sum 0
-- ----------------------------------------------------------------------------
BEGIN;
SET LOCAL session_replication_role = replica;
DO $outer$
DECLARE
    v_group   CONSTANT UUID := '00000000-0000-0000-0000-0000005317e0';
    v_a       CONSTANT UUID := '00000000-0000-0000-0000-0000005317a1';
    v_b       CONSTANT UUID := '00000000-0000-0000-0000-0000005317b2';
    v_expense CONSTANT UUID := '00000000-0000-0000-0000-0000005317e1';
    v_sum NUMERIC; v_a_net NUMERIC; v_b_net NUMERIC; v_payload JSONB;
BEGIN
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token) VALUES
        (v_a, 'Ari', 'ILS', TRUE, 'tt_ov_a'), (v_b, 'Bar', 'ILS', TRUE, 'tt_ov_b');
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'OVER test', 'ILS', TRUE, v_a, 'tt_ov_grp');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_a, TRUE), (v_group, v_b, TRUE);
    INSERT INTO public.expenses (id, group_id, description, amount, currency, paid_by, created_by, is_deleted)
        VALUES (v_expense, v_group, 'oversplit', 30, 'ILS', v_a, v_a, FALSE);
    INSERT INTO public.expense_splits (expense_id, user_id, amount) VALUES
        (v_expense, v_a, 20), (v_expense, v_b, 20);

    v_payload := public.get_user_simplified_inputs(v_a);
    SELECT COALESCE(SUM((n->>'net')::numeric),0) INTO v_sum
      FROM jsonb_array_elements(v_payload->'groups') grp, jsonb_array_elements(grp->'currencies') cur,
           jsonb_array_elements(cur->'nets') n
     WHERE grp->>'groupId'=v_group::text AND cur->>'currency'='ILS';
    SELECT (n->>'net')::numeric INTO v_a_net
      FROM jsonb_array_elements(v_payload->'groups') grp, jsonb_array_elements(grp->'currencies') cur,
           jsonb_array_elements(cur->'nets') n
     WHERE grp->>'groupId'=v_group::text AND cur->>'currency'='ILS' AND n->>'userId'=v_a::text;
    SELECT (n->>'net')::numeric INTO v_b_net
      FROM jsonb_array_elements(v_payload->'groups') grp, jsonb_array_elements(grp->'currencies') cur,
           jsonb_array_elements(cur->'nets') n
     WHERE grp->>'groupId'=v_group::text AND cur->>'currency'='ILS' AND n->>'userId'=v_b::text;

    IF v_sum <> 0 THEN RAISE EXCEPTION 'CASE1 over-split: sum must be 0, got %', v_sum; END IF;
    IF v_a_net <> 20 THEN RAISE EXCEPTION 'CASE1 over-split: payer A expected +20, got %', v_a_net; END IF;
    IF v_b_net <> -20 THEN RAISE EXCEPTION 'CASE1 over-split: B expected -20, got %', v_b_net; END IF;
    RAISE NOTICE 'CASE1 over-split passed (A=+20, B=-20, sum 0)';
END;
$outer$;
ROLLBACK;


-- ----------------------------------------------------------------------------
-- CASE 2 — ORPHAN EXPENSE (no expense_splits rows at all). The payer is treated
-- as having consumed the whole amount; no debt is fabricated against anyone, so
-- all nets are zero and the group drops out of the payload entirely.
--   amount 50, paid by A, no splits => A = 50 - 0 - 50 = 0 ; B = 0 ; group omitted
-- ----------------------------------------------------------------------------
BEGIN;
SET LOCAL session_replication_role = replica;
DO $outer$
DECLARE
    v_group   CONSTANT UUID := '00000000-0000-0000-0000-0000005417e0';
    v_a       CONSTANT UUID := '00000000-0000-0000-0000-0000005417a1';
    v_b       CONSTANT UUID := '00000000-0000-0000-0000-0000005417b2';
    v_expense CONSTANT UUID := '00000000-0000-0000-0000-0000005417e1';
    v_group_present BOOLEAN; v_payload JSONB;
BEGIN
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token) VALUES
        (v_a, 'Ari', 'ILS', TRUE, 'tt_or_a'), (v_b, 'Bar', 'ILS', TRUE, 'tt_or_b');
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'ORPHAN test', 'ILS', TRUE, v_a, 'tt_or_grp');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_a, TRUE), (v_group, v_b, TRUE);
    INSERT INTO public.expenses (id, group_id, description, amount, currency, paid_by, created_by, is_deleted)
        VALUES (v_expense, v_group, 'orphan', 50, 'ILS', v_a, v_a, FALSE);

    v_payload := public.get_user_simplified_inputs(v_a);
    SELECT EXISTS(
        SELECT 1 FROM jsonb_array_elements(v_payload->'groups') grp
        WHERE grp->>'groupId' = v_group::text
    ) INTO v_group_present;

    IF v_group_present THEN
        RAISE EXCEPTION 'CASE2 orphan: group must be absent (no fabricated debt), present: %', (v_payload->'groups');
    END IF;
    RAISE NOTICE 'CASE2 orphan-expense passed (no debt fabricated, group omitted)';
END;
$outer$;
ROLLBACK;


-- ----------------------------------------------------------------------------
-- CASE 3 — DELETED/INACTIVE PAYER who is OWED money. A deleted account stays as
-- an inactive member; if they were the payer their CREDIT must not be dropped
-- (footprint includes payers), and they appear in members[] with a NULL name.
--   amount 30, paid by C (inactive, NULL name), splits C=10 / A=10 (rem 10 -> C)
--   => C = 30 - 10 - 10 = +10 (C is owed) ; A = -10 ; sum 0
-- ----------------------------------------------------------------------------
BEGIN;
SET LOCAL session_replication_role = replica;
DO $outer$
DECLARE
    v_group   CONSTANT UUID := '00000000-0000-0000-0000-0000005517e0';
    v_a       CONSTANT UUID := '00000000-0000-0000-0000-0000005517a1';
    v_c       CONSTANT UUID := '00000000-0000-0000-0000-0000005517c3';
    v_expense CONSTANT UUID := '00000000-0000-0000-0000-0000005517e1';
    v_sum NUMERIC; v_c_net NUMERIC; v_a_net NUMERIC; v_c_in_members BOOLEAN; v_payload JSONB;
BEGIN
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token) VALUES
        (v_a, 'Ari', 'ILS', TRUE,  'tt_dp_a'),
        (v_c, NULL,  'ILS', FALSE, 'tt_dp_c');
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'DELPAYER test', 'ILS', TRUE, v_a, 'tt_dp_grp');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_a, TRUE), (v_group, v_c, FALSE);
    INSERT INTO public.expenses (id, group_id, description, amount, currency, paid_by, created_by, is_deleted)
        VALUES (v_expense, v_group, 'C paid', 30, 'ILS', v_c, v_c, FALSE);
    INSERT INTO public.expense_splits (expense_id, user_id, amount) VALUES
        (v_expense, v_c, 10), (v_expense, v_a, 10);

    v_payload := public.get_user_simplified_inputs(v_a);
    SELECT COALESCE(SUM((n->>'net')::numeric),0) INTO v_sum
      FROM jsonb_array_elements(v_payload->'groups') grp, jsonb_array_elements(grp->'currencies') cur,
           jsonb_array_elements(cur->'nets') n
     WHERE grp->>'groupId'=v_group::text AND cur->>'currency'='ILS';
    SELECT (n->>'net')::numeric INTO v_c_net
      FROM jsonb_array_elements(v_payload->'groups') grp, jsonb_array_elements(grp->'currencies') cur,
           jsonb_array_elements(cur->'nets') n
     WHERE grp->>'groupId'=v_group::text AND cur->>'currency'='ILS' AND n->>'userId'=v_c::text;
    SELECT (n->>'net')::numeric INTO v_a_net
      FROM jsonb_array_elements(v_payload->'groups') grp, jsonb_array_elements(grp->'currencies') cur,
           jsonb_array_elements(cur->'nets') n
     WHERE grp->>'groupId'=v_group::text AND cur->>'currency'='ILS' AND n->>'userId'=v_a::text;
    SELECT EXISTS(
        SELECT 1 FROM jsonb_array_elements(v_payload->'groups') grp, jsonb_array_elements(grp->'members') m
        WHERE grp->>'groupId'=v_group::text AND m->>'userId'=v_c::text AND (m->>'name') IS NULL
    ) INTO v_c_in_members;

    IF v_sum <> 0 THEN RAISE EXCEPTION 'CASE3 deleted-payer: sum must be 0, got %', v_sum; END IF;
    IF v_c_net IS DISTINCT FROM 10 THEN RAISE EXCEPTION 'CASE3 deleted-payer: C must be owed +10, got %', v_c_net; END IF;
    IF v_a_net <> -10 THEN RAISE EXCEPTION 'CASE3 deleted-payer: A expected -10, got %', v_a_net; END IF;
    IF NOT v_c_in_members THEN RAISE EXCEPTION 'CASE3 deleted-payer: C must be in members[] with NULL name'; END IF;
    RAISE NOTICE 'CASE3 deleted-payer passed (C owed +10, A=-10, sum 0, C in members NULL name)';
END;
$outer$;
ROLLBACK;


-- ----------------------------------------------------------------------------
-- CASE 4 — MULTI-CURRENCY isolation. Each currency's remainder is attributed
-- within that currency only; each currency nets to zero independently.
--   ILS: amount 30, split 10+10, remainder 10 -> A  => A=+10, B=-10
--   USD: amount 20, split  5+5,  remainder 10 -> A  => A=+5,  B=-5
-- ----------------------------------------------------------------------------
BEGIN;
SET LOCAL session_replication_role = replica;
DO $outer$
DECLARE
    v_group CONSTANT UUID := '00000000-0000-0000-0000-0000005617e0';
    v_a     CONSTANT UUID := '00000000-0000-0000-0000-0000005617a1';
    v_b     CONSTANT UUID := '00000000-0000-0000-0000-0000005617b2';
    v_e1    CONSTANT UUID := '00000000-0000-0000-0000-0000005617e1';
    v_e2    CONSTANT UUID := '00000000-0000-0000-0000-0000005617e2';
    v_ils_sum NUMERIC; v_usd_sum NUMERIC; v_a_ils NUMERIC; v_a_usd NUMERIC; v_b_ils NUMERIC; v_b_usd NUMERIC; v_payload JSONB;
BEGIN
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token) VALUES
        (v_a, 'Ari', 'ILS', TRUE, 'tt_mc_a'), (v_b, 'Bar', 'ILS', TRUE, 'tt_mc_b');
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'MULTICUR test', 'ILS', TRUE, v_a, 'tt_mc_grp');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_a, TRUE), (v_group, v_b, TRUE);
    INSERT INTO public.expenses (id, group_id, description, amount, currency, paid_by, created_by, is_deleted) VALUES
        (v_e1, v_group, 'ils', 30, 'ILS', v_a, v_a, FALSE),
        (v_e2, v_group, 'usd', 20, 'USD', v_a, v_a, FALSE);
    INSERT INTO public.expense_splits (expense_id, user_id, amount) VALUES
        (v_e1, v_a, 10), (v_e1, v_b, 10), (v_e2, v_a, 5), (v_e2, v_b, 5);

    v_payload := public.get_user_simplified_inputs(v_a);
    SELECT COALESCE(SUM((n->>'net')::numeric),0) INTO v_ils_sum FROM jsonb_array_elements(v_payload->'groups') grp,
        jsonb_array_elements(grp->'currencies') cur, jsonb_array_elements(cur->'nets') n
     WHERE grp->>'groupId'=v_group::text AND cur->>'currency'='ILS';
    SELECT COALESCE(SUM((n->>'net')::numeric),0) INTO v_usd_sum FROM jsonb_array_elements(v_payload->'groups') grp,
        jsonb_array_elements(grp->'currencies') cur, jsonb_array_elements(cur->'nets') n
     WHERE grp->>'groupId'=v_group::text AND cur->>'currency'='USD';
    SELECT (n->>'net')::numeric INTO v_a_ils FROM jsonb_array_elements(v_payload->'groups') grp,
        jsonb_array_elements(grp->'currencies') cur, jsonb_array_elements(cur->'nets') n
     WHERE grp->>'groupId'=v_group::text AND cur->>'currency'='ILS' AND n->>'userId'=v_a::text;
    SELECT (n->>'net')::numeric INTO v_a_usd FROM jsonb_array_elements(v_payload->'groups') grp,
        jsonb_array_elements(grp->'currencies') cur, jsonb_array_elements(cur->'nets') n
     WHERE grp->>'groupId'=v_group::text AND cur->>'currency'='USD' AND n->>'userId'=v_a::text;
    SELECT (n->>'net')::numeric INTO v_b_ils FROM jsonb_array_elements(v_payload->'groups') grp,
        jsonb_array_elements(grp->'currencies') cur, jsonb_array_elements(cur->'nets') n
     WHERE grp->>'groupId'=v_group::text AND cur->>'currency'='ILS' AND n->>'userId'=v_b::text;
    SELECT (n->>'net')::numeric INTO v_b_usd FROM jsonb_array_elements(v_payload->'groups') grp,
        jsonb_array_elements(grp->'currencies') cur, jsonb_array_elements(cur->'nets') n
     WHERE grp->>'groupId'=v_group::text AND cur->>'currency'='USD' AND n->>'userId'=v_b::text;

    IF v_ils_sum <> 0 OR v_usd_sum <> 0 THEN
        RAISE EXCEPTION 'CASE4 multi-currency: each currency must net 0, got ILS=% USD=%', v_ils_sum, v_usd_sum; END IF;
    IF v_a_ils <> 10 OR v_b_ils <> -10 THEN
        RAISE EXCEPTION 'CASE4 multi-currency: ILS expected A=+10 B=-10, got A=% B=%', v_a_ils, v_b_ils; END IF;
    IF v_a_usd <> 5 OR v_b_usd <> -5 THEN
        RAISE EXCEPTION 'CASE4 multi-currency: USD expected A=+5 B=-5, got A=% B=%', v_a_usd, v_b_usd; END IF;
    RAISE NOTICE 'CASE4 multi-currency passed (ILS A=+10/B=-10, USD A=+5/B=-5)';
END;
$outer$;
ROLLBACK;
