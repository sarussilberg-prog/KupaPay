-- #329 — Only enqueue profile-images cleanup for object paths under the deleting user's prefix.

CREATE OR REPLACE FUNCTION public.profile_images_object_path_for_user(
    p_user_id UUID,
    p_avatar_url TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    v_raw   TEXT;
    v_path  TEXT;
    v_prefix TEXT;
BEGIN
    IF p_user_id IS NULL OR p_avatar_url IS NULL THEN
        RETURN NULL;
    END IF;

    v_raw := btrim(p_avatar_url);
    IF v_raw = '' THEN
        RETURN NULL;
    END IF;

    IF v_raw ~* '^https?://' THEN
        v_path := regexp_replace(v_raw, '^.*(/storage/v1/object/(?:public|sign)/profile-images/)(.+)$', '\2', 'i');
        IF v_path = v_raw THEN
            RETURN NULL;
        END IF;
        v_path := split_part(v_path, '?', 1);
        v_path := split_part(v_path, '#', 1);
    ELSE
        v_path := split_part(v_raw, '?', 1);
    END IF;

    v_path := trim(both '/' FROM v_path);
    IF v_path = '' OR position('/' IN v_path) = 0 THEN
        RETURN NULL;
    END IF;

    v_prefix := p_user_id::text || '/';
    IF left(v_path, length(v_prefix)) <> v_prefix THEN
        RETURN NULL;
    END IF;

    IF v_path ~ '\.\.' THEN
        RETURN NULL;
    END IF;

    RETURN v_path;
END;
$$;

REVOKE ALL ON FUNCTION public.profile_images_object_path_for_user(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_images_object_path_for_user(UUID, TEXT) TO service_role;

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
    v_avatar_path TEXT;
    v_balance JSONB;
    v_recent  INT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT COUNT(*)::INT INTO v_recent
    FROM public.account_deletions_audit
    WHERE user_id = v_user_id
      AND deleted_at > NOW() - INTERVAL '1 hour'
      AND reason = 'self_service';

    IF v_recent >= 3 THEN
        RAISE EXCEPTION 'delete_rate_limit_exceeded' USING ERRCODE = '42501';
    END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
    IF v_email IS NULL OR v_email LIKE '%@deleted.kupapay.invalid' THEN
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
            pro_until = NULL,
            included_trip_pass_credits = 0,
            is_active = FALSE,
            deleted_at = NOW(),
            updated_at = NOW()
        WHERE id = v_user_id
          AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'profile_already_inactive';
    END IF;

    UPDATE auth.users
        SET banned_until = NULL,
            email = v_user_id::text || '@deleted.kupapay.invalid',
            raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
                - 'full_name' - 'name' - 'avatar_url',
            raw_app_meta_data = '{}'::jsonb
        WHERE id = v_user_id;

    DELETE FROM auth.refresh_tokens WHERE user_id = v_user_id::text;
    DELETE FROM auth.sessions WHERE user_id = v_user_id;

    UPDATE public.device_tokens
        SET disabled_at = NOW()
        WHERE user_id = v_user_id
          AND disabled_at IS NULL;

    INSERT INTO account_deletions_audit (
        user_id, email_hash, reason, open_balance_snapshot, recovery_email
    )
    VALUES (v_user_id, v_hash, 'self_service', v_balance, v_email);

    v_avatar_path := public.profile_images_object_path_for_user(v_user_id, v_avatar);
    IF v_avatar_path IS NOT NULL THEN
        INSERT INTO storage_cleanup_queue (bucket, object_path)
            VALUES ('profile-images', v_avatar_path)
            ON CONFLICT (bucket, object_path) DO NOTHING;
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
