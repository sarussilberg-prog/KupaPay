-- #306 — Recurring expense RPCs bind payer/splits to active group members.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_alice CONSTANT UUID := '00000000-0000-0000-0000-000000306001';
    v_bob   CONSTANT UUID := '00000000-0000-0000-0000-000000306002';
    v_out   CONSTANT UUID := '00000000-0000-0000-0000-000000306099';
    v_group CONSTANT UUID := '00000000-0000-0000-0000-000000306010';
    v_series UUID;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_alice, 're306-alice@test.local'),
        (v_bob,   're306-bob@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token, pro_until) VALUES
        (v_alice, 'Alice', 'ILS', TRUE, 're306Alice12', NOW() + INTERVAL '30 days'),
        (v_bob,   'Bob',   'ILS', TRUE, 're306Bob0123', NULL);
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'RE306', 'ILS', TRUE, v_alice, 're306Group123');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_alice, TRUE),
        (v_group, v_bob, TRUE);

    SET LOCAL session_replication_role = origin;
    PERFORM public.test_set_authenticated(v_alice);

    BEGIN
        PERFORM public.create_recurring_expense_series(
            v_group,
            'Rent',
            100,
            'ILS',
            'housing',
            CURRENT_DATE,
            NULL,
            v_out,
            'equal',
            jsonb_build_array(
                jsonb_build_object('user_id', v_alice, 'amount', 50),
                jsonb_build_object('user_id', v_bob, 'amount', 50)
            ),
            'monthly',
            NULL
        );
        RAISE EXCEPTION 'Case A failed: outsider payer must be rejected';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%payer_not_group_member%' THEN
            RAISE;
        END IF;
    END;

    SELECT (public.create_recurring_expense_series(
        v_group,
        'Rent',
        100,
        'ILS',
        'housing',
        CURRENT_DATE,
        NULL,
        v_alice,
        'equal',
        jsonb_build_array(
            jsonb_build_object('user_id', v_alice, 'amount', 50),
            jsonb_build_object('user_id', v_bob, 'amount', 50)
        ),
        'monthly',
        NULL
    )->>'seriesId')::uuid INTO v_series;

    BEGIN
        PERFORM public.update_recurring_expense_series(
            v_series,
            NULL, NULL, NULL, NULL,
            v_out,
            NULL, NULL, NULL
        );
        RAISE EXCEPTION 'Case B failed: update to outsider payer must be rejected';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%payer_not_group_member%' THEN
            RAISE;
        END IF;
    END;

    BEGIN
        PERFORM public.update_recurring_expense_series(
            v_series,
            NULL, NULL, NULL, NULL,
            NULL, NULL,
            jsonb_build_array(
                jsonb_build_object('user_id', v_alice, 'amount', 50),
                jsonb_build_object('user_id', v_out, 'amount', 50)
            ),
            NULL
        );
        RAISE EXCEPTION 'Case C failed: split outsider must be rejected';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%split_user_not_group_member%' THEN
            RAISE;
        END IF;
    END;
END;
$outer$;

ROLLBACK;
