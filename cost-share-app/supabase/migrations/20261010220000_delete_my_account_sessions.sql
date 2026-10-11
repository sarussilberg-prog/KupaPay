-- delete_my_account: restore auth session revocation (regression from v2 repoint)
-- and ensure auth schema access for ban + token cleanup.

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_email   TEXT;
    v_hash    TEXT;
    v_avatar  TEXT;
    v_balance JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
    IF v_email IS NULL THEN
        RAISE EXCEPTION 'auth_user_missing';
    END IF;
    v_hash := encode(extensions.digest(lower(trim(v_email)), 'sha256'), 'hex');

    BEGIN
        v_balance := public.get_user_simplified_inputs(v_user_id);
    EXCEPTION WHEN OTHERS THEN
        v_balance := jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE);
    END;

    SELECT avatar_url INTO v_avatar FROM profiles WHERE id = v_user_id;

    INSERT INTO deleted_account_emails (email_hash)
        VALUES (v_hash)
        ON CONFLICT (email_hash) DO NOTHING;

    UPDATE profiles
        SET name = NULL,
            email = NULL,
            avatar_url = NULL,
            phone = NULL,
            is_active = FALSE,
            deleted_at = NOW(),
            updated_at = NOW()
        WHERE id = v_user_id
          AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'profile_already_inactive';
    END IF;

    UPDATE auth.users
        SET banned_until = 'infinity'::timestamptz,
            email = v_user_id::text || '@deleted.kupapay.invalid',
            raw_user_meta_data = '{}'::jsonb,
            raw_app_meta_data = '{}'::jsonb
        WHERE id = v_user_id;

    DELETE FROM auth.refresh_tokens WHERE user_id = v_user_id::text;
    DELETE FROM auth.sessions WHERE user_id = v_user_id;

    INSERT INTO account_deletions_audit (user_id, email_hash, reason, open_balance_snapshot)
        VALUES (v_user_id, v_hash, 'self_service', v_balance);

    IF v_avatar IS NOT NULL THEN
        INSERT INTO storage_cleanup_queue (object_path)
            VALUES (v_avatar)
            ON CONFLICT (bucket, object_path) DO NOTHING;
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM PUBLIC, anon; -- safe-breaking: self-serve delete is authenticated-only since v2.0
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
