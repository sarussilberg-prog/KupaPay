-- Pro v2: group spending insights RPCs (#164)

CREATE OR REPLACE FUNCTION public.get_group_spending_by_category(
    p_group_id UUID,
    p_currency VARCHAR(3)
)
RETURNS TABLE (
    category TEXT,
    total NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_currency VARCHAR(3);
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;
    IF NOT public.is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'not_group_member';
    END IF;
    IF NOT public.has_pro(v_uid, p_group_id) THEN
        RAISE EXCEPTION 'pro_required';
    END IF;

    v_currency := upper(trim(p_currency));
    IF v_currency IS NULL OR length(v_currency) <> 3 THEN
        RAISE EXCEPTION 'invalid_currency';
    END IF;

    RETURN QUERY
    SELECT
        COALESCE(e.category::text, 'uncategorized') AS category,
        round(COALESCE(SUM(e.amount), 0)::numeric, 2) AS total
    FROM public.expenses e
    WHERE e.group_id = p_group_id
      AND e.is_deleted = FALSE
      AND e.currency = v_currency
    GROUP BY COALESCE(e.category::text, 'uncategorized')
    ORDER BY total DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_group_spending_by_category(UUID, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_spending_by_category(UUID, VARCHAR) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_group_spending_by_member(
    p_group_id UUID,
    p_currency VARCHAR(3)
)
RETURNS TABLE (
    member_user_id UUID,
    total NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_currency VARCHAR(3);
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;
    IF NOT public.is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'not_group_member';
    END IF;
    IF NOT public.has_pro(v_uid, p_group_id) THEN
        RAISE EXCEPTION 'pro_required';
    END IF;

    v_currency := upper(trim(p_currency));
    IF v_currency IS NULL OR length(v_currency) <> 3 THEN
        RAISE EXCEPTION 'invalid_currency';
    END IF;

    RETURN QUERY
    SELECT
        e.paid_by AS member_user_id,
        round(COALESCE(SUM(e.amount), 0)::numeric, 2) AS total
    FROM public.expenses e
    WHERE e.group_id = p_group_id
      AND e.is_deleted = FALSE
      AND e.currency = v_currency
    GROUP BY e.paid_by
    ORDER BY total DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_group_spending_by_member(UUID, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_spending_by_member(UUID, VARCHAR) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_group_spending_by_week(
    p_group_id UUID,
    p_currency VARCHAR(3)
)
RETURNS TABLE (
    week_start DATE,
    total NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_currency VARCHAR(3);
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;
    IF NOT public.is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'not_group_member';
    END IF;
    IF NOT public.has_pro(v_uid, p_group_id) THEN
        RAISE EXCEPTION 'pro_required';
    END IF;

    v_currency := upper(trim(p_currency));
    IF v_currency IS NULL OR length(v_currency) <> 3 THEN
        RAISE EXCEPTION 'invalid_currency';
    END IF;

    RETURN QUERY
    SELECT
        date_trunc('week', e.expense_date)::date AS week_start,
        round(COALESCE(SUM(e.amount), 0)::numeric, 2) AS total
    FROM public.expenses e
    WHERE e.group_id = p_group_id
      AND e.is_deleted = FALSE
      AND e.currency = v_currency
    GROUP BY date_trunc('week', e.expense_date)::date
    ORDER BY week_start ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_group_spending_by_week(UUID, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_spending_by_week(UUID, VARCHAR) TO authenticated;
