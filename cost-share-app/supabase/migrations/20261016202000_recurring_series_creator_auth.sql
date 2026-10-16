-- #319 — Recurring stop/update: series created_by or group creator only.

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
    IF v_row.created_by IS DISTINCT FROM v_uid AND NOT public.is_group_creator(v_row.group_id) THEN
        RAISE EXCEPTION 'recurring_series_not_authorized' USING ERRCODE = '42501';
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
    IF v_row.created_by IS DISTINCT FROM v_uid AND NOT public.is_group_creator(v_row.group_id) THEN
        RAISE EXCEPTION 'recurring_series_not_authorized' USING ERRCODE = '42501';
    END IF;

    UPDATE public.recurring_expense_series
    SET ended_at = NOW(), updated_at = NOW()
    WHERE id = p_series_id
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;
