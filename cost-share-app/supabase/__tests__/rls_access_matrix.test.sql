-- Systematic RLS matrix: core group/expense/settlement tables × role × CRUD expectations.
-- Roles: anon, non-member (authenticated), member, creator (group owner / expense creator).
BEGIN;
SET LOCAL session_replication_role = replica;

DO $matrix$
DECLARE
    v_owner   CONSTANT UUID := '00000000-0000-0000-0000-000000a00101';
    v_member  CONSTANT UUID := '00000000-0000-0000-0000-000000a00102';
    v_friend  CONSTANT UUID := '00000000-0000-0000-0000-000000a00103';
    v_out     CONSTANT UUID := '00000000-0000-0000-0000-000000a00199';
    v_group   CONSTANT UUID := '00000000-0000-0000-0000-000000a00110';
    v_exp     CONSTANT UUID := '00000000-0000-0000-0000-000000a00120';
    v_rows    INT;
    v_seen    INT;
    v_state   JSONB;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_owner, 'rls-owner@test.local'),
        (v_member, 'rls-member@test.local'),
        (v_friend, 'rls-friend@test.local'),
        (v_out, 'rls-out@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token) VALUES
        (v_owner, 'Owner', 'ILS', TRUE, 'rlsOwner12345'),
        (v_member, 'Member', 'ILS', TRUE, 'rlsMember1234'),
        (v_friend, 'Friend', 'ILS', TRUE, 'rlsFriend1234'),
        (v_out, 'Out', 'ILS', TRUE, 'rlsOutsider12');
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'RLS Matrix', 'ILS', TRUE, v_owner, 'rlsGroup12345');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_owner, TRUE),
        (v_group, v_member, TRUE);
    INSERT INTO public.friendships (user_a_id, user_b_id, source)
        VALUES (LEAST(v_owner, v_member), GREATEST(v_owner, v_member), 'auto');
    INSERT INTO public.friendships (user_a_id, user_b_id, source)
        VALUES (LEAST(v_member, v_friend), GREATEST(v_member, v_friend), 'request');
    INSERT INTO public.expenses (
        id, group_id, description, amount, currency, expense_date, paid_by, created_by, split_mode
    ) VALUES (
        v_exp, v_group, 'Matrix dinner', 30, 'ILS', CURRENT_DATE, v_owner, v_owner, 'equal'
    );
    INSERT INTO public.expense_splits (expense_id, user_id, amount) VALUES
        (v_exp, v_owner, 15),
        (v_exp, v_member, 15);

    SET LOCAL session_replication_role = origin;

    -- ── groups SELECT ──
    PERFORM set_config('role', 'anon', TRUE);
    SELECT COUNT(*) INTO v_seen FROM public.groups WHERE id = v_group;
    IF v_seen <> 0 THEN
        RAISE EXCEPTION 'matrix[groups SELECT anon]: expected 0 rows, got %', v_seen;
    END IF;

    PERFORM public.test_set_authenticated(v_out);
    SELECT COUNT(*) INTO v_seen FROM public.groups WHERE id = v_group;
    IF v_seen <> 0 THEN
        RAISE EXCEPTION 'matrix[groups SELECT non-member]: expected 0 rows, got %', v_seen;
    END IF;

    PERFORM public.test_set_authenticated(v_member);
    SELECT COUNT(*) INTO v_seen FROM public.groups WHERE id = v_group;
    IF v_seen <> 1 THEN
        RAISE EXCEPTION 'matrix[groups SELECT member]: expected 1 row, got %', v_seen;
    END IF;

    -- ── groups UPDATE is_active (soft delete) ──
    BEGIN
        UPDATE public.groups SET is_active = FALSE WHERE id = v_group;
        RAISE EXCEPTION 'matrix[groups UPDATE member is_active]: must be denied';
    EXCEPTION WHEN insufficient_privilege OR check_violation OR OTHERS THEN
        IF SQLERRM NOT LIKE '%group_deactivate_creator_only%'
           AND SQLERRM NOT LIKE '%42501%' THEN
            RAISE;
        END IF;
    END;

    PERFORM public.test_set_authenticated(v_owner);
    UPDATE public.groups SET is_active = FALSE WHERE id = v_group;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'matrix[groups UPDATE creator is_active=false]: expected 1 row, got %', v_rows;
    END IF;
    UPDATE public.groups SET is_active = TRUE WHERE id = v_group;

    -- ── group_members SELECT ──
    PERFORM public.test_set_authenticated(v_out);
    SELECT COUNT(*) INTO v_seen FROM public.group_members WHERE group_id = v_group;
    IF v_seen <> 0 THEN
        RAISE EXCEPTION 'matrix[group_members SELECT non-member]: expected 0 rows, got %', v_seen;
    END IF;

    PERFORM public.test_set_authenticated(v_member);
    SELECT COUNT(*) INTO v_seen FROM public.group_members WHERE group_id = v_group;
    IF v_seen < 2 THEN
        RAISE EXCEPTION 'matrix[group_members SELECT member]: expected >=2 rows, got %', v_seen;
    END IF;

    -- ── group_members INSERT ──
    BEGIN
        INSERT INTO public.group_members (group_id, user_id, is_active)
            VALUES (v_group, v_out, TRUE);
        RAISE EXCEPTION 'matrix[group_members INSERT outsider]: must be denied';
    EXCEPTION WHEN insufficient_privilege OR check_violation OR OTHERS THEN
        IF SQLERRM NOT LIKE '%row-level security%'
           AND SQLERRM NOT LIKE '%42501%' THEN
            RAISE;
        END IF;
    END;

    INSERT INTO public.group_members (group_id, user_id, is_active)
        VALUES (v_group, v_friend, TRUE);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'matrix[group_members INSERT friend]: expected 1 row, got %', v_rows;
    END IF;

    -- ── group_members UPDATE (leave vs kick) ──
    UPDATE public.group_members
    SET is_active = FALSE, left_at = NOW()
    WHERE group_id = v_group AND user_id = v_owner AND is_active = TRUE;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN
        RAISE EXCEPTION 'matrix[group_members UPDATE member kick owner]: must affect 0 rows';
    END IF;

    -- ── expenses SELECT ──
    PERFORM public.test_set_authenticated(v_out);
    SELECT COUNT(*) INTO v_seen FROM public.expenses WHERE id = v_exp;
    IF v_seen <> 0 THEN
        RAISE EXCEPTION 'matrix[expenses SELECT non-member]: expected 0 rows, got %', v_seen;
    END IF;

    PERFORM public.test_set_authenticated(v_member);
    SELECT COUNT(*) INTO v_seen FROM public.expenses WHERE id = v_exp;
    IF v_seen <> 1 THEN
        RAISE EXCEPTION 'matrix[expenses SELECT member]: expected 1 row, got %', v_seen;
    END IF;

    -- ── expenses INSERT ──
    BEGIN
        INSERT INTO public.expenses (
            group_id, description, amount, currency, paid_by, created_by, is_deleted
        ) VALUES (
            v_group, 'forged', 1, 'ILS', v_member, v_owner, FALSE
        );
        RAISE EXCEPTION 'matrix[expenses INSERT wrong created_by]: must be denied';
    EXCEPTION WHEN insufficient_privilege OR check_violation OR OTHERS THEN
        IF SQLERRM NOT LIKE '%row-level security%'
           AND SQLERRM NOT LIKE '%42501%' THEN
            RAISE;
        END IF;
    END;

    INSERT INTO public.expenses (
        group_id, description, amount, currency, expense_date, paid_by, created_by, split_mode
    ) VALUES (
        v_group, 'member expense', 5, 'ILS', CURRENT_DATE, v_member, v_member, 'equal'
    );
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'matrix[expenses INSERT self created_by]: expected 1 row, got %', v_rows;
    END IF;

    -- ── expense_splits SELECT (via member) ──
    SELECT COUNT(*) INTO v_seen FROM public.expense_splits WHERE expense_id = v_exp;
    IF v_seen < 2 THEN
        RAISE EXCEPTION 'matrix[expense_splits SELECT member]: expected >=2 rows, got %', v_seen;
    END IF;

    -- ── expense_splits DELETE ──
    DELETE FROM public.expense_splits WHERE expense_id = v_exp AND user_id = v_member;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN
        RAISE EXCEPTION 'matrix[expense_splits DELETE non-creator]: must affect 0 rows';
    END IF;

    PERFORM public.test_set_authenticated(v_owner);
    DELETE FROM public.expense_splits WHERE expense_id = v_exp AND user_id = v_member;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'matrix[expense_splits DELETE creator]: expected 1 row, got %', v_rows;
    END IF;

    -- ── settlements INSERT ──
    PERFORM public.test_set_authenticated(v_member);
    BEGIN
        INSERT INTO public.settlements (
            group_id, from_user_id, to_user_id, amount, currency, settlement_date, created_by
        ) VALUES (
            v_group, v_owner, v_out, 10, 'ILS', CURRENT_DATE, v_member
        );
        RAISE EXCEPTION 'matrix[settlements INSERT non-party]: must be denied';
    EXCEPTION WHEN insufficient_privilege OR check_violation OR OTHERS THEN
        IF SQLERRM NOT LIKE '%row-level security%'
           AND SQLERRM NOT LIKE '%42501%' THEN
            RAISE;
        END IF;
    END;

    INSERT INTO public.settlements (
        group_id, from_user_id, to_user_id, amount, currency, settlement_date, created_by
    ) VALUES (
        v_group, v_member, v_owner, 3, 'ILS', CURRENT_DATE, v_member
    );
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'matrix[settlements INSERT party]: expected 1 row, got %', v_rows;
    END IF;

    -- ── inactive (self-deleted) caller: no financial reads (#331) ──
    PERFORM set_config('role', 'service_role', TRUE);
    UPDATE public.profiles SET is_active = FALSE, deleted_at = NOW() WHERE id = v_member;
    PERFORM public.test_set_authenticated(v_member);
    SELECT COUNT(*) INTO v_seen FROM public.expenses WHERE group_id = v_group;
    IF v_seen <> 0 THEN
        RAISE EXCEPTION 'matrix[expenses SELECT inactive member]: expected 0 rows, got %', v_seen;
    END IF;
    BEGIN
        PERFORM public.get_user_simplified_inputs(v_member);
        RAISE EXCEPTION 'matrix[get_user_simplified_inputs inactive]: must be denied';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%inactive_account%' AND SQLERRM NOT LIKE '%42501%' THEN
            RAISE;
        END IF;
    END;
    SELECT public.get_my_account_deletion_state() INTO v_state;
    IF (v_state->>'isDeleted')::boolean IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'matrix[deletion state inactive]: isDeleted expected TRUE';
    END IF;

    RAISE NOTICE 'rls_access_matrix.test.sql — all matrix checks passed';
END;
$matrix$;

ROLLBACK;
