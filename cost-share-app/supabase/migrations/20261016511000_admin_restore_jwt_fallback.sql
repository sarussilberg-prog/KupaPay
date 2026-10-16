-- SQL CI + edge sessions: auth.uid() can be NULL inside SECURITY DEFINER when JWT
-- GUCs were set in a rolled-back subtransaction. Fall back to request.jwt.claim.sub.

CREATE OR REPLACE FUNCTION public.admin_restore_deleted_account(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin UUID := auth.uid();
BEGIN
    IF v_admin IS NULL THEN
        v_admin := NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    END IF;

    IF NOT public.is_app_admin() THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;

    PERFORM public.restore_deleted_account(
        p_user_id,
        NULL,
        'restored_by_admin:' || COALESCE(v_admin::text, 'unknown')
    );
END;
$$;
