-- #533 — create/update expense RPCs return jsonb { ok, expense? | error_code }.

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
RETURNS jsonb
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
        RETURN jsonb_build_object('ok', false, 'error_code', 'not_authenticated');
    END IF;
    IF NOT public.is_group_member(p_group_id) THEN
        RETURN jsonb_build_object('ok', false, 'error_code', 'not_group_member');
    END IF;
    IF NOT public.is_caller_active() THEN
        RETURN jsonb_build_object('ok', false, 'error_code', 'inactive_account');
    END IF;
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'error_code', 'invalid_amount');
    END IF;
    IF p_splits IS NULL
        OR jsonb_typeof(p_splits) <> 'array'
        OR jsonb_array_length(p_splits) = 0 THEN
        RETURN jsonb_build_object('ok', false, 'error_code', 'splits_required');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = p_group_id
          AND gm.user_id = p_paid_by
          AND gm.is_active = TRUE
    ) THEN
        RETURN jsonb_build_object('ok', false, 'error_code', 'payer_not_group_member');
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
        RETURN jsonb_build_object('ok', false, 'error_code', 'split_user_not_group_member');
    END IF;

    SELECT COALESCE(SUM((s->>'amount')::numeric), 0)
      INTO v_total
      FROM jsonb_array_elements(p_splits) AS s;

    IF abs(v_total - p_amount) > 0.01 THEN
        RETURN jsonb_build_object('ok', false, 'error_code', 'splits_sum_mismatch');
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

    RETURN jsonb_build_object('ok', true, 'expense', to_jsonb(v_expense));
END;
$$;

CREATE OR REPLACE FUNCTION public.update_expense_with_splits(
    p_expense_id    uuid,
    p_expense_patch jsonb DEFAULT NULL,
    p_splits        jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid       uuid := auth.uid();
    v_existing  public.expenses;
    v_amount    numeric;
    v_total     numeric;
    v_expense   public.expenses;
    v_paid_by   uuid;
    v_bad       uuid;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error_code', 'not_authenticated');
    END IF;
    IF NOT public.is_caller_active() THEN
        RETURN jsonb_build_object('ok', false, 'error_code', 'inactive_account');
    END IF;

    SELECT * INTO v_existing
      FROM public.expenses
     WHERE id = p_expense_id
       AND is_deleted = false
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error_code', 'expense_not_found');
    END IF;

    IF NOT public.is_group_member(v_existing.group_id) THEN
        RETURN jsonb_build_object('ok', false, 'error_code', 'not_group_member');
    END IF;

    v_amount := v_existing.amount;
    IF p_expense_patch IS NOT NULL AND p_expense_patch ? 'amount' THEN
        v_amount := (p_expense_patch->>'amount')::numeric;
    END IF;

    IF v_amount IS NULL OR v_amount <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'error_code', 'invalid_amount');
    END IF;

    v_paid_by := v_existing.paid_by;
    IF p_expense_patch IS NOT NULL AND p_expense_patch ? 'paid_by' THEN
        v_paid_by := (p_expense_patch->>'paid_by')::uuid;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = v_existing.group_id
          AND gm.user_id = v_paid_by
          AND gm.is_active = TRUE
    ) THEN
        RETURN jsonb_build_object('ok', false, 'error_code', 'payer_not_group_member');
    END IF;

    IF p_splits IS NOT NULL THEN
        IF jsonb_typeof(p_splits) <> 'array' OR jsonb_array_length(p_splits) = 0 THEN
            RETURN jsonb_build_object('ok', false, 'error_code', 'splits_required');
        END IF;

        SELECT (s->>'user_id')::uuid INTO v_bad
        FROM jsonb_array_elements(p_splits) AS s
        WHERE NOT EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = v_existing.group_id
              AND gm.user_id = (s->>'user_id')::uuid
              AND gm.is_active = TRUE
        )
        LIMIT 1;
        IF v_bad IS NOT NULL THEN
            RETURN jsonb_build_object('ok', false, 'error_code', 'split_user_not_group_member');
        END IF;

        SELECT COALESCE(SUM((s->>'amount')::numeric), 0)
          INTO v_total
          FROM jsonb_array_elements(p_splits) AS s;

        IF abs(v_total - v_amount) > 0.01 THEN
            RETURN jsonb_build_object('ok', false, 'error_code', 'splits_sum_mismatch');
        END IF;
    END IF;

    UPDATE public.expenses e
       SET description  = COALESCE(p_expense_patch->>'description', e.description),
           amount       = v_amount,
           currency     = COALESCE(p_expense_patch->>'currency', e.currency),
           category     = CASE
                              WHEN p_expense_patch ? 'category' THEN p_expense_patch->>'category'
                              ELSE e.category
                          END,
           expense_date = COALESCE((p_expense_patch->>'expense_date')::date, e.expense_date),
           receipt_url  = CASE
                              WHEN p_expense_patch ? 'receipt_url' THEN p_expense_patch->>'receipt_url'
                              ELSE e.receipt_url
                          END,
           paid_by      = v_paid_by,
           split_mode   = COALESCE(p_expense_patch->>'split_mode', e.split_mode),
           updated_at   = now()
     WHERE e.id = p_expense_id
     RETURNING * INTO v_expense;

    IF p_splits IS NOT NULL THEN
        DELETE FROM public.expense_splits WHERE expense_id = p_expense_id;

        INSERT INTO public.expense_splits (expense_id, user_id, amount)
        SELECT p_expense_id, (s->>'user_id')::uuid, (s->>'amount')::numeric
          FROM jsonb_array_elements(p_splits) AS s;
    END IF;

    RETURN jsonb_build_object('ok', true, 'expense', to_jsonb(v_expense));
END;
$$;
