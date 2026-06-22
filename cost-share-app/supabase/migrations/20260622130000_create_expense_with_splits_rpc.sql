-- create_expense_with_splits — atomic expense creation.
--
-- WHY: the client previously inserted the expense row and its expense_splits in
-- two separate statements (two transactions). The `expenses` realtime INSERT
-- event fired on other devices the instant the first statement committed —
-- before the splits existed. Any balance refetch triggered by that event runs
-- get_user_simplified_inputs, which derives debts from expense_splits, so it
-- raced the splits write and intermittently read a balance that ignored the new
-- expense (the expense showed in the feed, but the summary/debts didn't move).
--
-- Inserting the expense and its splits in ONE transaction means the realtime
-- event only fires after both are committed, so every reader (the row fetch and
-- the balance RPC) sees a consistent, complete expense.

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
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;
    -- Same authorization as the table's INSERT RLS, enforced here because the
    -- function is SECURITY DEFINER (and so bypasses RLS on the inserts below).
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

    SELECT COALESCE(SUM((s->>'amount')::numeric), 0)
      INTO v_total
      FROM jsonb_array_elements(p_splits) AS s;

    -- Guard against corrupt ledgers (splits must sum to the amount, within a
    -- one-cent rounding tolerance). Mirrors the client-side validateExpenseSplits.
    IF abs(v_total - p_amount) > 0.01 THEN
        RAISE EXCEPTION 'splits (%) do not sum to amount (%)', v_total, p_amount;
    END IF;

    INSERT INTO public.expenses (
        group_id, description, amount, currency, category,
        expense_date, receipt_url, paid_by, created_by, split_mode
    ) VALUES (
        p_group_id,
        p_description,
        p_amount,
        COALESCE(NULLIF(p_currency, ''), 'USD'),
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

REVOKE EXECUTE ON FUNCTION public.create_expense_with_splits(
    uuid, text, numeric, text, text, date, text, uuid, text, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_expense_with_splits(
    uuid, text, numeric, text, text, date, text, uuid, text, jsonb
) TO authenticated;
