-- Pro v2: recurring expense series (#167)

CREATE TABLE IF NOT EXISTS public.recurring_expense_series (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    description     VARCHAR(255) NOT NULL,
    amount          DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    currency        VARCHAR(3) NOT NULL DEFAULT 'ILS',
    category        VARCHAR(50),
    paid_by         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_by      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    split_mode      TEXT NOT NULL DEFAULT 'equal'
        CHECK (split_mode IN ('equal', 'percent', 'amount')),
    splits_template JSONB NOT NULL,
    frequency       TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
    start_date      DATE NOT NULL,
    next_run_date   DATE NOT NULL,
    ended_at        TIMESTAMPTZ,
    timezone_hint   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_series_group
    ON public.recurring_expense_series(group_id);
CREATE INDEX IF NOT EXISTS idx_recurring_series_due
    ON public.recurring_expense_series(next_run_date)
    WHERE ended_at IS NULL;

CREATE TRIGGER update_recurring_expense_series_updated_at
    BEFORE UPDATE ON public.recurring_expense_series
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.recurring_expense_occurrences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id       UUID NOT NULL REFERENCES public.recurring_expense_series(id) ON DELETE CASCADE,
    scheduled_for   DATE NOT NULL,
    expense_id      UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (series_id, scheduled_for)
);

CREATE INDEX IF NOT EXISTS idx_recurring_occurrences_series
    ON public.recurring_expense_occurrences(series_id);

ALTER TABLE public.recurring_expense_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expense_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group members read recurring series"
    ON public.recurring_expense_series FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = recurring_expense_series.group_id
              AND gm.user_id = auth.uid()
              AND gm.is_active = TRUE
        )
    );

CREATE POLICY "group members read recurring occurrences"
    ON public.recurring_expense_occurrences FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.recurring_expense_series rs
            JOIN public.group_members gm ON gm.group_id = rs.group_id
            WHERE rs.id = recurring_expense_occurrences.series_id
              AND gm.user_id = auth.uid()
              AND gm.is_active = TRUE
        )
    );

-- Internal: insert expense + splits from series template (service_role / definer only).
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

REVOKE ALL ON FUNCTION public._insert_expense_from_recurring_series(public.recurring_expense_series, date) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._advance_recurring_next_date(
    p_from DATE,
    p_frequency TEXT
)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE p_frequency
        WHEN 'weekly' THEN (p_from + INTERVAL '7 days')::date
        WHEN 'monthly' THEN (p_from + INTERVAL '1 month')::date
        WHEN 'yearly' THEN (p_from + INTERVAL '1 year')::date
        ELSE p_from
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

    SELECT COALESCE(SUM((s->>'amount')::numeric), 0)
      INTO v_total
      FROM jsonb_array_elements(p_splits) AS s;
    IF abs(v_total - p_amount) > 0.01 THEN
        RAISE EXCEPTION 'splits do not sum to amount';
    END IF;

    INSERT INTO public.recurring_expense_series (
        group_id, description, amount, currency, category,
        paid_by, created_by, split_mode, splits_template,
        frequency, start_date, next_run_date, timezone_hint
    ) VALUES (
        p_group_id,
        p_description,
        p_amount,
        COALESCE(NULLIF(p_currency, ''), 'USD'),
        p_category,
        p_paid_by,
        v_uid,
        COALESCE(NULLIF(p_split_mode, ''), 'equal'),
        p_splits,
        p_frequency,
        COALESCE(p_expense_date, CURRENT_DATE),
        public._advance_recurring_next_date(COALESCE(p_expense_date, CURRENT_DATE), p_frequency),
        p_timezone_hint
    )
    RETURNING * INTO v_series;

    -- First occurrence on start date (receipt on first expense only when provided).
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

REVOKE ALL ON FUNCTION public.create_recurring_expense_series(
    uuid, text, numeric, text, text, date, text, uuid, text, jsonb, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_recurring_expense_series(
    uuid, text, numeric, text, text, date, text, uuid, text, jsonb, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_recurring_expense_series(
    p_series_id uuid,
    p_description text DEFAULT NULL,
    p_amount numeric DEFAULT NULL,
    p_currency text DEFAULT NULL,
    p_category text DEFAULT NULL,
    p_paid_by uuid DEFAULT NULL,
    p_split_mode text DEFAULT NULL,
    p_splits jsonb DEFAULT NULL,
    p_frequency text DEFAULT NULL
)
RETURNS public.recurring_expense_series
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_row public.recurring_expense_series;
    v_total numeric;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;
    SELECT * INTO v_row FROM public.recurring_expense_series WHERE id = p_series_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'series not found';
    END IF;
    IF v_row.ended_at IS NOT NULL THEN
        RAISE EXCEPTION 'series ended';
    END IF;
    IF NOT public.is_group_member(v_row.group_id) THEN
        RAISE EXCEPTION 'not a member of group';
    END IF;
    IF NOT public.has_pro(v_uid, v_row.group_id) THEN
        RAISE EXCEPTION 'pro required';
    END IF;

    IF p_splits IS NOT NULL THEN
        SELECT COALESCE(SUM((s->>'amount')::numeric), 0)
          INTO v_total
          FROM jsonb_array_elements(p_splits) AS s;
        IF abs(v_total - COALESCE(p_amount, v_row.amount)) > 0.01 THEN
            RAISE EXCEPTION 'splits do not sum to amount';
        END IF;
    END IF;

    UPDATE public.recurring_expense_series
    SET
        description = COALESCE(p_description, description),
        amount = COALESCE(p_amount, amount),
        currency = COALESCE(NULLIF(p_currency, ''), currency),
        category = COALESCE(p_category, category),
        paid_by = COALESCE(p_paid_by, paid_by),
        split_mode = COALESCE(NULLIF(p_split_mode, ''), split_mode),
        splits_template = COALESCE(p_splits, splits_template),
        frequency = COALESCE(p_frequency, frequency),
        updated_at = NOW()
    WHERE id = p_series_id
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.update_recurring_expense_series(
    uuid, text, numeric, text, text, uuid, text, jsonb, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_recurring_expense_series(
    uuid, text, numeric, text, text, uuid, text, jsonb, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.stop_recurring_expense_series(p_series_id uuid)
RETURNS public.recurring_expense_series
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_row public.recurring_expense_series;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;
    SELECT * INTO v_row FROM public.recurring_expense_series WHERE id = p_series_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'series not found';
    END IF;
    IF NOT public.is_group_member(v_row.group_id) THEN
        RAISE EXCEPTION 'not a member of group';
    END IF;
    IF NOT public.has_pro(v_uid, v_row.group_id) THEN
        RAISE EXCEPTION 'pro required';
    END IF;

    UPDATE public.recurring_expense_series
    SET ended_at = NOW(), updated_at = NOW()
    WHERE id = p_series_id
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.stop_recurring_expense_series(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stop_recurring_expense_series(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_recurring_series_for_expense(p_expense_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'seriesId', rs.id,
        'frequency', rs.frequency,
        'nextRunDate', rs.next_run_date,
        'endedAt', rs.ended_at,
        'scheduledFor', ro.scheduled_for
    )
    FROM public.recurring_expense_occurrences ro
    JOIN public.recurring_expense_series rs ON rs.id = ro.series_id
    WHERE ro.expense_id = p_expense_id
      AND EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = rs.group_id
            AND gm.user_id = auth.uid()
            AND gm.is_active = TRUE
      );
$$;

REVOKE ALL ON FUNCTION public.get_recurring_series_for_expense(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_recurring_series_for_expense(uuid) TO authenticated;

-- Cron / service_role: generate due occurrences (idempotent).
CREATE OR REPLACE FUNCTION public.generate_due_recurring_expenses(p_limit int DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lock boolean;
    v_created int := 0;
    v_series public.recurring_expense_series;
    v_today date := CURRENT_DATE;
BEGIN
    v_lock := pg_try_advisory_lock(8712345678901234);
    IF NOT v_lock THEN
        RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'lock_not_acquired');
    END IF;

    BEGIN
        FOR v_series IN
            SELECT *
            FROM public.recurring_expense_series
            WHERE ended_at IS NULL
              AND next_run_date <= v_today
            ORDER BY next_run_date
            LIMIT GREATEST(p_limit, 1)
            FOR UPDATE SKIP LOCKED
        LOOP
            PERFORM public._insert_expense_from_recurring_series(v_series, v_series.next_run_date);

            UPDATE public.recurring_expense_series
            SET next_run_date = public._advance_recurring_next_date(v_series.next_run_date, v_series.frequency),
                updated_at = NOW()
            WHERE id = v_series.id;

            v_created := v_created + 1;
        END LOOP;
    EXCEPTION WHEN OTHERS THEN
        PERFORM pg_advisory_unlock(8712345678901234);
        RAISE;
    END;

    PERFORM pg_advisory_unlock(8712345678901234);
    RETURN jsonb_build_object('ok', true, 'created', v_created);
END;
$$;

REVOKE ALL ON FUNCTION public.generate_due_recurring_expenses(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_due_recurring_expenses(int) TO service_role;
