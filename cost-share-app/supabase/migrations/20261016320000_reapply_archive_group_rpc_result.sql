-- Re-apply archive_group JSONB RPC (prod recorded 20261016120000 as pro_trial_reminder_cron, so archive SQL never ran there).
-- Idempotent: identical to 20261016120000_archive_group_rpc_result.sql; safe on dev (already JSONB).

DROP FUNCTION IF EXISTS public.archive_group(UUID); -- safe-breaking: mobile ships JSONB archive_group before prod deploy

CREATE OR REPLACE FUNCTION public.archive_group(p_group_id UUID)
RETURNS JSONB
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
        RETURN jsonb_build_object('ok', false, 'error_code', 'not_authenticated');
    END IF;

    IF NOT public.is_group_member(p_group_id) THEN
        RETURN jsonb_build_object('ok', false, 'error_code', 'not_a_member');
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
        RETURN jsonb_build_object('ok', false, 'error_code', 'has_balance');
    END IF;

    INSERT INTO group_user_archive (user_id, group_id)
        VALUES (v_user_id, p_group_id)
    ON CONFLICT (user_id, group_id) DO NOTHING;

    RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.archive_group(UUID) FROM PUBLIC, anon; -- safe-breaking: replaces grants on recreated RPC
GRANT EXECUTE ON FUNCTION public.archive_group(UUID) TO authenticated;
