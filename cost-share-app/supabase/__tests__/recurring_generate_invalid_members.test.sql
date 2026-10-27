-- Generator ends series when payer or split member leaves the group.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_alice CONSTANT UUID := '00000000-0000-0000-0000-000000168001';
    v_bob   CONSTANT UUID := '00000000-0000-0000-0000-000000168002';
    v_group CONSTANT UUID := '00000000-0000-0000-0000-000000168010';
    v_series UUID;
    v_before INT;
    v_after INT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_alice, 're168-alice@test.local'),
        (v_bob,   're168-bob@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token, pro_until) VALUES
        (v_alice, 'Alice', 'ILS', TRUE, 're168Alice12', NOW() + INTERVAL '30 days'),
        (v_bob,   'Bob',   'ILS', TRUE, 're168Bob0123', NULL);
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'RE168', 'ILS', TRUE, v_alice, 're168Group123');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_alice, TRUE),
        (v_group, v_bob, TRUE);

    SET LOCAL session_replication_role = origin;
    PERFORM public.test_set_authenticated(v_alice);

    SELECT (public.create_recurring_expense_series(
        v_group, 'Utilities', 50, 'ILS', 'utilities',
        CURRENT_DATE - 14, NULL, v_alice, 'equal',
        jsonb_build_array(
            jsonb_build_object('user_id', v_alice, 'amount', 25),
            jsonb_build_object('user_id', v_bob, 'amount', 25)
        ),
        'weekly', 'UTC'
    )->>'seriesId')::uuid INTO v_series;

    UPDATE public.recurring_expense_series
    SET next_run_date = CURRENT_DATE - 7
    WHERE id = v_series;

    UPDATE public.group_members SET is_active = FALSE WHERE group_id = v_group AND user_id = v_bob;

    SELECT COUNT(*) INTO v_before FROM public.recurring_expense_occurrences WHERE series_id = v_series;

    PERFORM set_config('role', 'service_role', TRUE);
    PERFORM public.generate_due_recurring_expenses(5);

    SELECT COUNT(*) INTO v_after FROM public.recurring_expense_occurrences WHERE series_id = v_series;
    IF v_after <> v_before THEN
        RAISE EXCEPTION 'Case invalid member failed: occurrences % -> %', v_before, v_after;
    END IF;
    IF (SELECT ended_at IS NULL FROM public.recurring_expense_series WHERE id = v_series) THEN
        RAISE EXCEPTION 'Case invalid member failed: series should be ended';
    END IF;

    RAISE NOTICE 'recurring_generate_invalid_members.test.sql — passed';
END;
$outer$;

ROLLBACK;
