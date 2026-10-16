-- ============================================================================
-- Regression: archive_group must allow archive when get_user_simplified_inputs
-- shows the caller settled in the group — including odd-cent 50/50 splits
-- (10.01 -> 5.00 / 5.01) followed by a matching settle-up payment.
--
-- Reproduces iOS bug: UI "Settled" + archive toast "Settle your balance…".
-- Root cause was archive_group using inverted settlement signs vs canonical RPC.
--
-- Run via Supabase MCP execute_sql against dev. BEGIN/ROLLBACK — no persist.
-- Requires migration 20261012180000_archive_group_simplified_balance.sql.
-- ============================================================================

BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_group   CONSTANT UUID := '00000000-0000-0000-0000-000000958a01';
    v_payer   CONSTANT UUID := '00000000-0000-0000-0000-000000958aa1';
    v_borrow  CONSTANT UUID := '00000000-0000-0000-0000-000000958ab2';
    v_e1 CONSTANT UUID := '00000000-0000-0000-0000-000000958ae1';
    v_e2 CONSTANT UUID := '00000000-0000-0000-0000-000000958ae2';
    v_e3 CONSTANT UUID := '00000000-0000-0000-0000-000000958ae3';
    v_e4 CONSTANT UUID := '00000000-0000-0000-0000-000000958ae4';
    v_payload JSONB;
    v_group_rows INT;
    v_legacy_payer_net NUMERIC;
    k_jwt_sub CONSTANT text := 'request.jwt.claim.sub';
    k_jwt_claims CONSTANT text := 'request.jwt.claims';
    k_role CONSTANT text := 'role';
    k_authenticated CONSTANT text := 'authenticated';
BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_payer, 'arch-usd-p@test.local');

    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token) VALUES
        (v_payer, 'Payer', 'USD', TRUE, 'tt_arc_p'),
        (v_borrow, 'Borrow', 'USD', TRUE, 'tt_arc_b');

    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'Archive USD cents', 'USD', TRUE, v_payer, 'tt_arc_grp');

    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_payer, TRUE),
        (v_group, v_borrow, TRUE);

    INSERT INTO public.expenses (id, group_id, description, amount, currency, paid_by, created_by, is_deleted) VALUES
        (v_e1, v_group, 'cents', 10.01, 'USD', v_payer, v_payer, FALSE),
        (v_e2, v_group, 'three', 3, 'USD', v_payer, v_payer, FALSE),
        (v_e3, v_group, 'hundred', 100, 'USD', v_payer, v_payer, FALSE),
        (v_e4, v_group, 'twentyfive', 25, 'USD', v_payer, v_payer, FALSE);

    INSERT INTO public.expense_splits (expense_id, user_id, amount) VALUES
        (v_e1, v_payer, 5.00),
        (v_e1, v_borrow, 5.01),
        (v_e2, v_payer, 1.50),
        (v_e2, v_borrow, 1.50),
        (v_e3, v_payer, 50.00),
        (v_e3, v_borrow, 50.00),
        (v_e4, v_payer, 12.50),
        (v_e4, v_borrow, 12.50);

    INSERT INTO public.settlements (group_id, from_user_id, to_user_id, amount, currency, created_by)
        VALUES (v_group, v_borrow, v_payer, 69.01, 'USD', v_borrow);

    -- Legacy archive_group formula (pre-20261012180000): inverted settlements.
    v_legacy_payer_net :=
        (10.01 + 3 + 100 + 25)
        - (5.00 + 1.50 + 50 + 12.50)
        + 69.01
        - 0;
    IF ABS(v_legacy_payer_net) < 0.01 THEN
        RAISE EXCEPTION 'Sanity failed: legacy formula should show open balance, got %', v_legacy_payer_net;
    END IF;

    PERFORM set_config(k_jwt_sub, v_payer::text, TRUE);
    PERFORM set_config(k_jwt_claims, json_build_object('sub', v_payer::text)::text, TRUE);
    PERFORM set_config(k_role, k_authenticated, TRUE);

    v_payload := public.get_user_simplified_inputs(v_payer);
    SELECT COUNT(*) INTO v_group_rows
      FROM jsonb_array_elements(v_payload->'groups') g
     WHERE g->>'groupId' = v_group::text;

    IF v_group_rows <> 0 THEN
        RAISE EXCEPTION 'Canonical inputs: payer should be settled (group omitted), got % rows', v_group_rows;
    END IF;

    PERFORM set_config(k_jwt_sub, v_payer::text, true);
    PERFORM set_config(k_jwt_claims, json_build_object('sub', v_payer::text)::text, true);

    PERFORM public.archive_group(v_group);

    IF NOT EXISTS (
        SELECT 1 FROM public.group_user_archive
         WHERE user_id = v_payer AND group_id = v_group
    ) THEN
        RAISE EXCEPTION 'archive_group did not insert archive row for payer';
    END IF;

    PERFORM set_config(k_jwt_sub, v_borrow::text, true);
    PERFORM set_config(k_jwt_claims, json_build_object('sub', v_borrow::text)::text, true);
    PERFORM public.archive_group(v_group);

    RAISE NOTICE 'archive_group_settled_usd.test.sql — all cases passed';
END;
$outer$;

ROLLBACK;
