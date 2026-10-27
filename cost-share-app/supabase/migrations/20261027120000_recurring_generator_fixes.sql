-- Recurring expenses: catch-up dispatch, IANA timezone "today", inactive group stop,
-- group default currency, clamped month/year advance, split-member validation on generate.

CREATE OR REPLACE FUNCTION public._recurring_local_today(p_timezone_hint text)
RETURNS date
LANGUAGE sql
STABLE
AS $$
    SELECT (timezone(COALESCE(NULLIF(btrim(p_timezone_hint), ''), 'UTC'), now()))::date;
$$;

CREATE OR REPLACE FUNCTION public._advance_recurring_next_date(
    p_from DATE,
    p_frequency TEXT
)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    y int := EXTRACT(YEAR FROM p_from)::int;
    m int := EXTRACT(MONTH FROM p_from)::int;
    d int := EXTRACT(DAY FROM p_from)::int;
    next_y int;
    next_m int;
    last_day int;
BEGIN
    CASE p_frequency
        WHEN 'weekly' THEN
            RETURN (p_from + INTERVAL '7 days')::date;
        WHEN 'monthly' THEN
            IF m = 12 THEN
                next_y := y + 1;
                next_m := 1;
            ELSE
                next_y := y;
                next_m := m + 1;
            END IF;
            last_day := EXTRACT(
                DAY FROM (
                    DATE_TRUNC('month', make_date(next_y, next_m, 1)) + INTERVAL '1 month - 1 day'
                )
            )::int;
            RETURN make_date(next_y, next_m, LEAST(d, last_day));
        WHEN 'yearly' THEN
            next_y := y + 1;
            last_day := EXTRACT(
                DAY FROM (
                    DATE_TRUNC('month', make_date(next_y, m, 1)) + INTERVAL '1 month - 1 day'
                )
            )::int;
            RETURN make_date(next_y, m, LEAST(d, last_day));
        ELSE
            RETURN p_from;
    END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public._recurring_series_has_invalid_members(p_series public.recurring_expense_series)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT
        NOT EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = p_series.group_id
              AND gm.user_id = p_series.paid_by
              AND gm.is_active = TRUE
        )
        OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements(p_series.splits_template) AS s
            WHERE NOT EXISTS (
                SELECT 1 FROM public.group_members gm
                WHERE gm.group_id = p_series.group_id
                  AND gm.user_id = (s->>'user_id')::uuid
                  AND gm.is_active = TRUE
            )
        );
$$;

CREATE OR REPLACE FUNCTION public._insert_expense_from_recurring_series(
    p_series public.recurring_expense_series,
    p_scheduled_for DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_expense public.expenses;
    v_total   numeric;
    v_existing uuid;
BEGIN
    IF public._recurring_series_has_invalid_members(p_series) THEN
        UPDATE public.recurring_expense_series
        SET ended_at = NOW(), updated_at = NOW()
        WHERE id = p_series.id AND ended_at IS NULL;
        RAISE EXCEPTION 'recurring_series_invalid_members';
    END IF;

    SELECT expense_id INTO v_existing
    FROM public.recurring_expense_occurrences
    WHERE series_id = p_series.id AND scheduled_for = p_scheduled_for;
    IF v_existing IS NOT NULL THEN
        RETURN v_existing;
    END IF;

    SELECT COALESCE(SUM((s->>'amount')::numeric), 0)
      INTO v_total
      FROM jsonb_array_elements(p_series.splits_template) AS s;

    IF abs(v_total - p_series.amount) > 0.01 THEN
        RAISE EXCEPTION 'series splits do not sum to amount';
    END IF;

    INSERT INTO public.expenses (
        group_id, description, amount, currency, category,
        expense_date, receipt_url, paid_by, created_by, split_mode
    ) VALUES (
        p_series.group_id,
        p_series.description,
        p_series.amount,
        p_series.currency,
        p_series.category,
        p_scheduled_for,
        NULL,
        p_series.paid_by,
        p_series.created_by,
        p_series.split_mode
    )
    RETURNING * INTO v_expense;

    INSERT INTO public.expense_splits (expense_id, user_id, amount)
    SELECT v_expense.id, (s->>'user_id')::uuid, (s->>'amount')::numeric
      FROM jsonb_array_elements(p_series.splits_template) AS s;

    INSERT INTO public.recurring_expense_occurrences (series_id, scheduled_for, expense_id)
    VALUES (p_series.id, p_scheduled_for, v_expense.id);

    RETURN v_expense.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_recurring_expense_series(
    p_group_id     uuid,
    p_description  text,
    p_amount       numeric,
    p_currency     text,
    p_category     text,
    p_expense_date date,
    p_receipt_url  text,
    p_paid_by      uuid,
    p_split_mode   text,
    p_splits       jsonb,
    p_frequency    text,
    p_timezone_hint text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid    uuid := auth.uid();
    v_series public.recurring_expense_series;
    v_total  numeric;
    v_expense_id uuid;
    v_bad    uuid;
    v_currency text;
    v_start    date;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;
    IF NOT public.is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'not a member of group';
    END IF;
    IF NOT public.is_caller_active() THEN
        RAISE EXCEPTION 'inactive account';
    END IF;
    IF NOT public.has_pro(v_uid, p_group_id) THEN
        RAISE EXCEPTION 'pro required';
    END IF;
    IF p_frequency NOT IN ('weekly', 'monthly', 'yearly') THEN
        RAISE EXCEPTION 'invalid frequency';
    END IF;
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'invalid amount';
    END IF;
    IF p_splits IS NULL OR jsonb_typeof(p_splits) <> 'array' OR jsonb_array_length(p_splits) = 0 THEN
        RAISE EXCEPTION 'splits required';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = p_group_id
          AND gm.user_id = p_paid_by
          AND gm.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'payer_not_group_member';
    END IF;

    SELECT (s->>'user_id')::uuid INTO v_bad
    FROM jsonb_array_elements(p_splits) AS s
    WHERE NOT EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = p_group_id
          AND gm.user_id = (s->>'user_id')::uuid
          AND gm.is_active = TRUE
    )
    LIMIT 1;
    IF v_bad IS NOT NULL THEN
        RAISE EXCEPTION 'split_user_not_group_member';
    END IF;

    SELECT COALESCE(SUM((s->>'amount')::numeric), 0)
      INTO v_total
      FROM jsonb_array_elements(p_splits) AS s;
    IF abs(v_total - p_amount) > 0.01 THEN
        RAISE EXCEPTION 'splits do not sum to amount';
    END IF;

    SELECT COALESCE(
        NULLIF(btrim(p_currency), ''),
        g.default_currency,
        'USD'
    )
    INTO v_currency
    FROM public.groups g
    WHERE g.id = p_group_id;

    v_start := COALESCE(p_expense_date, public._recurring_local_today(p_timezone_hint));

    INSERT INTO public.recurring_expense_series (
        group_id, description, amount, currency, category,
        paid_by, created_by, split_mode, splits_template,
        frequency, start_date, next_run_date, timezone_hint
    ) VALUES (
        p_group_id,
        p_description,
        p_amount,
        v_currency,
        p_category,
        p_paid_by,
        v_uid,
        COALESCE(NULLIF(p_split_mode, ''), 'equal'),
        p_splits,
        p_frequency,
        v_start,
        public._advance_recurring_next_date(v_start, p_frequency),
        p_timezone_hint
    )
    RETURNING * INTO v_series;

    INSERT INTO public.expenses (
        group_id, description, amount, currency, category,
        expense_date, receipt_url, paid_by, created_by, split_mode
    ) VALUES (
        v_series.group_id,
        v_series.description,
        v_series.amount,
        v_series.currency,
        v_series.category,
        v_series.start_date,
        p_receipt_url,
        v_series.paid_by,
        v_uid,
        v_series.split_mode
    )
    RETURNING id INTO v_expense_id;

    INSERT INTO public.expense_splits (expense_id, user_id, amount)
    SELECT v_expense_id, (s->>'user_id')::uuid, (s->>'amount')::numeric
      FROM jsonb_array_elements(p_splits) AS s;

    INSERT INTO public.recurring_expense_occurrences (series_id, scheduled_for, expense_id)
    VALUES (v_series.id, v_series.start_date, v_expense_id);

    RETURN jsonb_build_object(
        'seriesId', v_series.id,
        'expenseId', v_expense_id,
        'nextRunDate', v_series.next_run_date
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_due_recurring_expenses(p_limit int DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lock boolean;
    v_created int := 0;
    v_skipped int := 0;
    v_ended_inactive int := 0;
    v_series public.recurring_expense_series;
    v_today date;
    v_run_date date;
    v_budget int := GREATEST(p_limit, 1);
BEGIN
    v_lock := pg_try_advisory_lock(8712345678901234);
    IF NOT v_lock THEN
        RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'lock_not_acquired');
    END IF;

    BEGIN
        FOR v_series IN
            SELECT rs.*
            FROM public.recurring_expense_series rs
            WHERE rs.ended_at IS NULL
              AND rs.next_run_date <= public._recurring_local_today(rs.timezone_hint)
            ORDER BY rs.next_run_date
            FOR UPDATE SKIP LOCKED
        LOOP
            IF v_created >= v_budget THEN
                EXIT;
            END IF;

            IF NOT COALESCE(
                (SELECT g.is_active FROM public.groups g WHERE g.id = v_series.group_id),
                FALSE
            ) THEN
                UPDATE public.recurring_expense_series
                SET ended_at = NOW(), updated_at = NOW()
                WHERE id = v_series.id;
                v_ended_inactive := v_ended_inactive + 1;
                CONTINUE;
            END IF;

            IF NOT public.has_pro(v_series.created_by, v_series.group_id) THEN
                UPDATE public.recurring_expense_series
                SET ended_at = NOW(), updated_at = NOW()
                WHERE id = v_series.id;
                v_skipped := v_skipped + 1;
                CONTINUE;
            END IF;

            v_today := public._recurring_local_today(v_series.timezone_hint);
            v_run_date := v_series.next_run_date;

            WHILE v_run_date <= v_today AND v_created < v_budget LOOP
                BEGIN
                    PERFORM public._insert_expense_from_recurring_series(v_series, v_run_date);
                EXCEPTION
                    WHEN OTHERS THEN
                        IF SQLERRM LIKE '%recurring_series_invalid_members%' THEN
                            v_skipped := v_skipped + 1;
                            EXIT;
                        END IF;
                        RAISE;
                END;

                v_run_date := public._advance_recurring_next_date(v_run_date, v_series.frequency);
                v_created := v_created + 1;
            END LOOP;

            UPDATE public.recurring_expense_series
            SET next_run_date = v_run_date,
                updated_at = NOW()
            WHERE id = v_series.id;

            SELECT * INTO v_series FROM public.recurring_expense_series WHERE id = v_series.id;
        END LOOP;
    EXCEPTION WHEN OTHERS THEN
        PERFORM pg_advisory_unlock(8712345678901234);
        RAISE;
    END;

    PERFORM pg_advisory_unlock(8712345678901234);
    RETURN jsonb_build_object(
        'ok', true,
        'created', v_created,
        'ended_no_pro', v_skipped,
        'ended_inactive_group', v_ended_inactive
    );
END;
$$;
