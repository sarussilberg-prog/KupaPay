-- #319 — Recurring update/stop: created_by or group creator.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_owner CONSTANT UUID := '00000000-0000-0000-0000-000000319001';
    v_alice CONSTANT UUID := '00000000-0000-0000-0000-000000319002';
    v_group CONSTANT UUID := '00000000-0000-0000-0000-000000319010';
    v_series UUID;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_owner, 'rs319-owner@test.local'),
        (v_alice, 'rs319-alice@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token, pro_until) VALUES
        (v_owner, 'Owner', 'ILS', TRUE, 'rs319Owner12', NOW() + INTERVAL '30 days'),
        (v_alice, 'Alice', 'ILS', TRUE, 'rs319Alice12', NOW() + INTERVAL '30 days');
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'RS319', 'ILS', TRUE, v_owner, 'rs319Group123');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_owner, TRUE),
        (v_group, v_alice, TRUE);

    SET LOCAL session_replication_role = origin;
    PERFORM public.test_set_authenticated(v_owner);

    SELECT (public.create_recurring_expense_series(
        v_group, 'Sub', 10, 'ILS', 'misc', CURRENT_DATE, NULL,
        v_owner, 'equal',
        jsonb_build_array(
            jsonb_build_object('user_id', v_owner, 'amount', 5),
            jsonb_build_object('user_id', v_alice, 'amount', 5)
        ),
        'monthly', NULL
    )->>'seriesId')::uuid INTO v_series;

    PERFORM public.test_set_authenticated(v_alice);
    BEGIN
        PERFORM public.update_recurring_expense_series(v_series, 'Hacked', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
        RAISE EXCEPTION 'Case A failed: non-creator member must not update series';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%recurring_series_not_authorized%' AND SQLERRM NOT LIKE '%42501%' THEN
            RAISE;
        END IF;
    END;

    PERFORM public.test_set_authenticated(v_owner);
    PERFORM public.stop_recurring_expense_series(v_series);
END;
$outer$;

ROLLBACK;
