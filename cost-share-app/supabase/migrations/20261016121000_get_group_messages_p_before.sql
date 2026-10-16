-- Reconcile dev/prod drift: optional p_before cursor for paginated group chat (KI-030).

DROP FUNCTION IF EXISTS public.get_group_messages(UUID, INT);
DROP FUNCTION IF EXISTS public.get_group_messages(UUID, INT, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_group_messages(
    p_group_id UUID,
    p_limit INT DEFAULT 100,
    p_before TIMESTAMPTZ DEFAULT NULL
)
RETURNS SETOF public.group_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_limit INT;
BEGIN
    IF NOT public.is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'not a member of group';
    END IF;

    v_limit := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200);

    RETURN QUERY
    SELECT m.*
    FROM public.group_messages m
    WHERE m.group_id = p_group_id
      AND m.is_deleted = FALSE
      AND (p_before IS NULL OR m.created_at < p_before)
    ORDER BY m.created_at DESC
    LIMIT v_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_group_messages(UUID, INT, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_messages(UUID, INT, TIMESTAMPTZ) TO authenticated;
