-- update_expense_with_splits — atomic expense edit (expense row + splits in one transaction).
--
-- WHY: the client previously deleted all splits, inserted new ones, then patched
-- the expense in separate statements. A network drop between them could leave an
-- expense with no splits or splits that no longer match the amount.

CREATE OR REPLACE FUNCTION public.update_expense_with_splits(
    p_expense_id    uuid,
    p_expense_patch jsonb DEFAULT NULL,
    p_splits        jsonb DEFAULT NULL
)
RETURNS public.expenses
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
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;
    IF NOT public.is_caller_active() THEN
        RAISE EXCEPTION 'inactive account';
    END IF;

    SELECT * INTO v_existing
      FROM public.expenses
     WHERE id = p_expense_id
       AND is_deleted = false
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'expense not found';
    END IF;

    IF NOT public.is_group_member(v_existing.group_id) THEN
        RAISE EXCEPTION 'not a member of group';
    END IF;

    v_amount := v_existing.amount;
    IF p_expense_patch IS NOT NULL AND p_expense_patch ? 'amount' THEN
        v_amount := (p_expense_patch->>'amount')::numeric;
    END IF;

    IF v_amount IS NULL OR v_amount <= 0 THEN
        RAISE EXCEPTION 'invalid amount';
    END IF;

    IF p_splits IS NOT NULL THEN
        IF jsonb_typeof(p_splits) <> 'array' OR jsonb_array_length(p_splits) = 0 THEN
            RAISE EXCEPTION 'splits required';
        END IF;

        SELECT COALESCE(SUM((s->>'amount')::numeric), 0)
          INTO v_total
          FROM jsonb_array_elements(p_splits) AS s;

        IF abs(v_total - v_amount) > 0.01 THEN
            RAISE EXCEPTION 'splits (%) do not sum to amount (%)', v_total, v_amount;
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
           paid_by      = COALESCE((p_expense_patch->>'paid_by')::uuid, e.paid_by),
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

    RETURN v_expense;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_expense_with_splits(uuid, jsonb, jsonb)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_expense_with_splits(uuid, jsonb, jsonb)
    TO authenticated;
