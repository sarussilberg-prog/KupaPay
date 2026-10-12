-- =============================================================================
-- 20261012180000_archive_group_simplified_balance.sql
--
-- archive_group previously computed net as paid - owed + settled_received -
-- settled_paid (settlements inverted vs get_user_simplified_inputs). After a
-- full settle-up the UI showed "Settled" but archive RPC raised has_balance.
--
-- Align the guard with the canonical simplified-inputs balance (cent tolerance
-- 0.01), same source as group summary / Settled chips.
-- =============================================================================

CREATE OR REPLACE FUNCTION archive_group(p_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_payload JSONB;
    v_open_balance BOOLEAN;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    IF NOT public.is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'not_a_member';
    END IF;

    v_payload := public.get_user_simplified_inputs(v_user_id);

    SELECT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_payload->'groups') g,
             jsonb_array_elements(g->'currencies') c,
             jsonb_array_elements(c->'nets') n
        WHERE g->>'groupId' = p_group_id::text
          AND n->>'userId' = v_user_id::text
          AND ABS((n->>'net')::numeric) >= 0.01
    )
    INTO v_open_balance;

    IF v_open_balance THEN
        RAISE EXCEPTION 'has_balance';
    END IF;

    INSERT INTO group_user_archive (user_id, group_id)
        VALUES (v_user_id, p_group_id)
    ON CONFLICT (user_id, group_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION archive_group(UUID) TO authenticated;
