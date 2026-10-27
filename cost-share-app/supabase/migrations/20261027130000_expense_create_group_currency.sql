-- Empty expense currency must use group default (multi-currency / ILS groups).

CREATE OR REPLACE FUNCTION public.create_expense_with_splits(
    p_group_id     uuid,
    p_description  text,
    p_amount       numeric,
    p_currency     text,
    p_category     text,
    p_expense_date date,
    p_receipt_url  text,
    p_paid_by      uuid,
    p_split_mode   text,
    p_splits       jsonb
)
RETURNS public.expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid     uuid := auth.uid();
    v_expense public.expenses;
    v_total   numeric;
    v_bad     uuid;
    v_currency text;
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
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'invalid amount';
    END IF;
    IF p_splits IS NULL
        OR jsonb_typeof(p_splits) <> 'array'
        OR jsonb_array_length(p_splits) = 0 THEN
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
        RAISE EXCEPTION 'splits (%) do not sum to amount (%)', v_total, p_amount;
    END IF;

    SELECT COALESCE(
        NULLIF(btrim(p_currency), ''),
        g.default_currency,
        'USD'
    )
    INTO v_currency
    FROM public.groups g
    WHERE g.id = p_group_id;

    INSERT INTO public.expenses (
        group_id, description, amount, currency, category,
        expense_date, receipt_url, paid_by, created_by, split_mode
    ) VALUES (
        p_group_id,
        p_description,
        p_amount,
        v_currency,
        p_category,
        COALESCE(p_expense_date, CURRENT_DATE),
        p_receipt_url,
        p_paid_by,
        v_uid,
        COALESCE(NULLIF(p_split_mode, ''), 'equal')
    )
    RETURNING * INTO v_expense;

    INSERT INTO public.expense_splits (expense_id, user_id, amount)
    SELECT v_expense.id, (s->>'user_id')::uuid, (s->>'amount')::numeric
      FROM jsonb_array_elements(p_splits) AS s;

    RETURN v_expense;
END;
$$;
