-- #306 — Recurring create/update: active-member checks for payer and splits (#288/#301 parity).

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
    v_paid_by uuid;
    v_bad uuid;
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

    v_paid_by := COALESCE(p_paid_by, v_row.paid_by);
    IF NOT EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = v_row.group_id
          AND gm.user_id = v_paid_by
          AND gm.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'payer_not_group_member';
    END IF;

    IF p_splits IS NOT NULL THEN
        IF jsonb_typeof(p_splits) <> 'array' OR jsonb_array_length(p_splits) = 0 THEN
            RAISE EXCEPTION 'splits required';
        END IF;

        SELECT (s->>'user_id')::uuid INTO v_bad
        FROM jsonb_array_elements(p_splits) AS s
        WHERE NOT EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = v_row.group_id
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
        paid_by = v_paid_by,
        split_mode = COALESCE(NULLIF(p_split_mode, ''), split_mode),
        splits_template = COALESCE(p_splits, splits_template),
        frequency = COALESCE(p_frequency, frequency),
        updated_at = NOW()
    WHERE id = p_series_id
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;
