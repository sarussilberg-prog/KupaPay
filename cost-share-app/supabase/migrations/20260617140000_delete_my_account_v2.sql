-- Replace the v1 stub of delete_my_account() with the v2 body.
-- The v1 stub only flipped profiles.is_active=false + deleted_at=now(); it
-- never scrubbed PII, never set auth.users.banned_until, never inserted the
-- audit row, and never hashed the email into deleted_account_emails. Every
-- in-app account deletion since the admin portal shipped has therefore
-- produced an "orphan" soft-delete that the admin "Deleted users" list
-- (which reads from account_deletions_audit) cannot see.
--
-- All v2 prerequisites (account_deletions_audit, deleted_account_emails,
-- storage_cleanup_queue, check_email_not_deleted trigger, restore_deleted_account)
-- are already present in prod — only the function body is out of date.
--
-- Idempotent: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id  UUID := auth.uid();
    v_email    TEXT;
    v_avatar   TEXT;
    v_hash     TEXT;
    v_balance  JSONB;
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
        v_balance := get_user_balance_summary(v_user_id);
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
        SET banned_until = 'infinity'::timestamptz
        WHERE id = v_user_id;

    INSERT INTO account_deletions_audit (user_id, email_hash, reason, open_balance_snapshot)
        VALUES (v_user_id, v_hash, 'self_service', v_balance);

    IF v_avatar IS NOT NULL THEN
        INSERT INTO storage_cleanup_queue (object_path)
            VALUES (v_avatar)
            ON CONFLICT (bucket, object_path) DO NOTHING;
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
