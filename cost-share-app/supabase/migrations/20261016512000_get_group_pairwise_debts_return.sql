-- Avoid 42702 ambiguous `currency` between OUT params and core columns on RETURN QUERY SELECT *.

CREATE OR REPLACE FUNCTION public.get_group_pairwise_debts(p_group_id UUID)
RETURNS TABLE (
    from_user_id UUID,
    to_user_id UUID,
    currency VARCHAR,
    amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
    IF NOT public.is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'not a member of group';
    END IF;
    RETURN QUERY
    SELECT * FROM public._get_group_pairwise_debts_core(p_group_id);
END;
$$;
