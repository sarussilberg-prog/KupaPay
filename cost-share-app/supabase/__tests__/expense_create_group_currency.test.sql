-- #517 follow-up — create_expense_with_splits uses group default when currency omitted.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_alice CONSTANT UUID := '00000000-0000-0000-0000-000000521001';
    v_bob   CONSTANT UUID := '00000000-0000-0000-0000-000000521002';
    v_group CONSTANT UUID := '00000000-0000-0000-0000-000000521010';
    v_exp   public.expenses;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_alice, 'ec521-alice@test.local'),
        (v_bob,   'ec521-bob@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token) VALUES
        (v_alice, 'Alice', 'ILS', TRUE, 'ec521Alice12'),
        (v_bob,   'Bob',   'ILS', TRUE, 'ec521Bob0123');
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'EC521', 'ILS', TRUE, v_alice, 'ec521Group123');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_alice, TRUE),
        (v_group, v_bob, TRUE);

    SET LOCAL session_replication_role = origin;
    PERFORM public.test_set_authenticated(v_alice);

    v_exp := public.create_expense_with_splits(
        v_group,
        'Groceries',
        40,
        '',
        'food',
        CURRENT_DATE,
        NULL,
        v_alice,
        'equal',
        jsonb_build_array(
            jsonb_build_object('user_id', v_alice, 'amount', 20),
            jsonb_build_object('user_id', v_bob, 'amount', 20)
        )
    );

    IF v_exp.currency <> 'ILS' THEN
        RAISE EXCEPTION 'Case A failed: expected ILS, got %', v_exp.currency;
    END IF;

    RAISE NOTICE 'expense_create_group_currency.test.sql — passed';
END;
$outer$;

ROLLBACK;
