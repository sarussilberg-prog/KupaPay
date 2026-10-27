-- Recurring generator: catch-up, timezone hint, idempotency, currency/splits, inactive group, RLS.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_alice CONSTANT UUID := '00000000-0000-0000-0000-000000167001';
    v_bob   CONSTANT UUID := '00000000-0000-0000-0000-000000167002';
    v_out   CONSTANT UUID := '00000000-0000-0000-0000-000000167099';
    v_group CONSTANT UUID := '00000000-0000-0000-0000-000000167010';
    v_series UUID;
    v_result JSONB;
    v_count INT;
    v_currency TEXT;
    v_split_sum NUMERIC;
    v_next DATE;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_alice, 're167-alice@test.local'),
        (v_bob,   're167-bob@test.local'),
        (v_out,   're167-out@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token, pro_until) VALUES
        (v_alice, 'Alice', 'ILS', TRUE, 're167Alice12', NOW() + INTERVAL '30 days'),
        (v_bob,   'Bob',   'ILS', TRUE, 're167Bob0123', NULL),
        (v_out,   'Out',   'ILS', TRUE, 're167Out12345', NULL);
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'RE167', 'ILS', TRUE, v_alice, 're167Group123');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_alice, TRUE),
        (v_group, v_bob, TRUE);

    SET LOCAL session_replication_role = origin;
    PERFORM public.test_set_authenticated(v_alice);

    -- Empty currency must follow group default (ILS), not USD.
    SELECT (public.create_recurring_expense_series(
        v_group,
        'Rent',
        100,
        '',
        'housing',
        CURRENT_DATE - 21,
        NULL,
        v_alice,
        'equal',
        jsonb_build_array(
            jsonb_build_object('user_id', v_alice, 'amount', 50),
            jsonb_build_object('user_id', v_bob, 'amount', 50)
        ),
        'weekly',
        'Asia/Jerusalem'
    )->>'seriesId')::uuid INTO v_series;

    SELECT currency INTO v_currency FROM public.recurring_expense_series WHERE id = v_series;
    IF v_currency <> 'ILS' THEN
        RAISE EXCEPTION 'Case currency failed: expected ILS, got %', v_currency;
    END IF;

    PERFORM set_config('role', 'service_role', TRUE);

    -- Catch-up: start was 3 weeks ago; weekly should materialize missed runs in one dispatch (limit 10).
    v_result := public.generate_due_recurring_expenses(10);
    SELECT COUNT(*) INTO v_count
      FROM public.recurring_expense_occurrences
     WHERE series_id = v_series;
    IF v_count < 4 THEN
        RAISE EXCEPTION 'Case catch-up failed: expected >=4 occurrences, got % (result=%)', v_count, v_result;
    END IF;

    SELECT next_run_date INTO v_next FROM public.recurring_expense_series WHERE id = v_series;
    IF v_next <= (timezone('Asia/Jerusalem', now()))::date THEN
        RAISE EXCEPTION 'Case catch-up failed: next_run_date % still due in Asia/Jerusalem', v_next;
    END IF;

    IF COALESCE((v_result->>'created')::int, 0) <= 0 THEN
        RAISE EXCEPTION 'Case idempotency setup failed: first run created nothing (%)', v_result;
    END IF;

    -- Idempotency: second run must not add rows.
    SELECT COUNT(*) INTO v_count
      FROM public.recurring_expense_occurrences
     WHERE series_id = v_series;
    PERFORM public.generate_due_recurring_expenses(10);
    IF (SELECT COUNT(*) FROM public.recurring_expense_occurrences WHERE series_id = v_series) <> v_count THEN
        RAISE EXCEPTION 'Case idempotency failed: occurrence count changed after second run';
    END IF;

    -- Currency + splits on one generated expense (not the anchor occurrence).
    SELECT e.currency, COALESCE(SUM(es.amount), 0)
      INTO v_currency, v_split_sum
      FROM public.recurring_expense_occurrences ro
      JOIN public.expenses e ON e.id = ro.expense_id
      JOIN public.expense_splits es ON es.expense_id = e.id
     WHERE ro.id = (
         SELECT ro2.id
           FROM public.recurring_expense_occurrences ro2
          WHERE ro2.series_id = v_series
            AND ro2.scheduled_for <> (
                SELECT start_date FROM public.recurring_expense_series WHERE id = v_series
            )
          ORDER BY ro2.scheduled_for
          LIMIT 1
       )
     GROUP BY e.id, e.currency;
    IF v_currency IS DISTINCT FROM 'ILS' OR abs(v_split_sum - 100) > 0.01 THEN
        RAISE EXCEPTION 'Case template failed: currency=% split_sum=%', v_currency, v_split_sum;
    END IF;

    -- Inactive group: series must stop generating.
    UPDATE public.groups SET is_active = FALSE WHERE id = v_group;
    PERFORM public.generate_due_recurring_expenses(10);
    IF (SELECT ended_at IS NULL FROM public.recurring_expense_series WHERE id = v_series) THEN
        RAISE EXCEPTION 'Case inactive group failed: series should be ended';
    END IF;

    -- RLS: outsider cannot read series.
    PERFORM public.test_set_authenticated(v_out);
    SELECT COUNT(*) INTO v_count FROM public.recurring_expense_series WHERE group_id = v_group;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'Case RLS failed: outsider read % series rows', v_count;
    END IF;

    RAISE NOTICE 'recurring_generate_due.test.sql — all cases passed';
END;
$outer$;

ROLLBACK;
