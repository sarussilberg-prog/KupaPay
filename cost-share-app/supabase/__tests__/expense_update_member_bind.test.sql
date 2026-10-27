-- #297 — Expense UPDATE adversarial (paid_by / splits membership).
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_alice CONSTANT UUID := '00000000-0000-0000-0000-000000297001';
    v_bob   CONSTANT UUID := '00000000-0000-0000-0000-000000297002';
    v_out   CONSTANT UUID := '00000000-0000-0000-0000-000000297099';
    v_group CONSTANT UUID := '00000000-0000-0000-0000-000000297010';
    v_exp   CONSTANT UUID := '00000000-0000-0000-0000-000000297020';
    v_res   jsonb;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_alice, 'ex297-alice@test.local'),
        (v_bob,   'ex297-bob@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token) VALUES
        (v_alice, 'Alice', 'ILS', TRUE, 'ex297Alice12'),
        (v_bob,   'Bob',   'ILS', TRUE, 'ex297Bob0123');
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'EX297', 'ILS', TRUE, v_alice, 'ex297Group123');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_alice, TRUE),
        (v_group, v_bob, TRUE);
    INSERT INTO public.expenses (
        id, group_id, description, amount, currency, paid_by, created_by, is_deleted
    ) VALUES (
        v_exp, v_group, 'dinner', 30, 'ILS', v_alice, v_alice, FALSE
    );
    INSERT INTO public.expense_splits (expense_id, user_id, amount)
        VALUES (v_exp, v_alice, 15), (v_exp, v_bob, 15);

    SET LOCAL session_replication_role = origin;
    PERFORM public.test_set_authenticated(v_alice);

    BEGIN
        UPDATE public.expenses SET paid_by = v_out WHERE id = v_exp;
        RAISE EXCEPTION 'Case A failed: outsider paid_by must be denied';
    EXCEPTION WHEN insufficient_privilege OR check_violation OR OTHERS THEN
        IF SQLERRM NOT LIKE '%row-level security%' AND SQLERRM NOT LIKE '%42501%' THEN
            RAISE;
        END IF;
    END;

    v_res := public.update_expense_with_splits(
        v_exp,
        NULL,
        jsonb_build_array(
            jsonb_build_object('user_id', v_out, 'amount', 30)
        )
    );
    IF (v_res->>'ok')::boolean IS NOT FALSE
        OR v_res->>'error_code' IS DISTINCT FROM 'split_user_not_group_member' THEN
        RAISE EXCEPTION 'Case B failed: RPC must reject outsider split user, got %', v_res;
    END IF;

    PERFORM public.update_expense_with_splits(
        v_exp,
        jsonb_build_object('description', 'updated'),
        jsonb_build_array(
            jsonb_build_object('user_id', v_alice, 'amount', 15),
            jsonb_build_object('user_id', v_bob, 'amount', 15)
        )
    );
END;
$outer$;

ROLLBACK;
