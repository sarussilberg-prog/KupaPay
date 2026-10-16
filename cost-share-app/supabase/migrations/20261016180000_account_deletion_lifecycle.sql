-- Account deletion lifecycle: grace-period self-restore, IDOR lockdown on
-- restore_deleted_account, recovery email retention, hard purge after grace,
-- device-token cleanup, and delete rate limiting.

-- ---------------------------------------------------------------------------
-- Audit: retain recovery email only until restore or hard purge (GDPR Art. 17).
-- ---------------------------------------------------------------------------
ALTER TABLE public.account_deletions_audit
    ADD COLUMN IF NOT EXISTS recovery_email TEXT,
    ADD COLUMN IF NOT EXISTS hard_purged_at TIMESTAMPTZ;

COMMENT ON COLUMN public.account_deletions_audit.recovery_email IS
    'Original login email at deletion time; cleared on restore or hard purge. Not exposed via RLS.';

-- ---------------------------------------------------------------------------
-- Grace interval (single source for RPCs + cron).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.account_deletion_grace_interval()
RETURNS INTERVAL
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT INTERVAL '30 days';
$$;

REVOKE ALL ON FUNCTION public.account_deletion_grace_interval() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- restore_deleted_account — internal; uses recovery_email when auth.users is scrubbed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_deleted_account(
    p_user_id UUID,
    p_restored_name TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_email     TEXT;
    v_meta_name TEXT;
    v_hash      TEXT;
    v_audit_id  UUID;
BEGIN
    SELECT a.id, a.recovery_email
    INTO v_audit_id, v_email
    FROM public.account_deletions_audit a
    WHERE a.user_id = p_user_id
      AND a.restored_at IS NULL
      AND a.hard_purged_at IS NULL
    ORDER BY a.deleted_at DESC
    LIMIT 1;

    IF v_audit_id IS NULL THEN
        RAISE EXCEPTION 'deletion_audit_missing';
    END IF;

    IF v_email IS NULL THEN
        SELECT email, raw_user_meta_data->>'full_name'
        INTO v_email, v_meta_name
        FROM auth.users
        WHERE id = p_user_id;
    ELSE
        SELECT raw_user_meta_data->>'full_name'
        INTO v_meta_name
        FROM auth.users
        WHERE id = p_user_id;
    END IF;

    IF v_email IS NULL OR v_email LIKE '%@deleted.kupapay.invalid' THEN
        RAISE EXCEPTION 'recovery_email_missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = p_user_id AND is_active = FALSE
    ) THEN
        RAISE EXCEPTION 'profile_not_deleted';
    END IF;

    v_hash := encode(extensions.digest(lower(trim(v_email)), 'sha256'), 'hex');

    DELETE FROM deleted_account_emails WHERE email_hash = v_hash;

    UPDATE auth.users
        SET banned_until = NULL,
            email = v_email
        WHERE id = p_user_id;

    UPDATE profiles
        SET is_active = TRUE,
            deleted_at = NULL,
            email = v_email,
            name = COALESCE(
                NULLIF(trim(p_restored_name), ''),
                NULLIF(trim(v_meta_name), ''),
                split_part(v_email, '@', 1)
            ),
            updated_at = NOW()
        WHERE id = p_user_id;

    UPDATE account_deletions_audit
        SET restored_at = NOW(),
            recovery_email = NULL,
            notes = COALESCE(p_notes, notes)
        WHERE id = v_audit_id;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_deleted_account(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_deleted_account(UUID, TEXT, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- delete_my_account — grace-friendly (no auth ban), recovery email, cleanup.
-- ---------------------------------------------------------------------------
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
        SET disabled_at = NOW(), updated_at = NOW()
        WHERE user_id = v_user_id
          AND disabled_at IS NULL;

    INSERT INTO account_deletions_audit (
        user_id, email_hash, reason, open_balance_snapshot, recovery_email
    )
    VALUES (v_user_id, v_hash, 'self_service', v_balance, v_email);

    IF v_avatar IS NOT NULL THEN
        INSERT INTO storage_cleanup_queue (object_path)
            VALUES (v_avatar)
            ON CONFLICT (bucket, object_path) DO NOTHING;
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- ---------------------------------------------------------------------------
-- Deletion state for the signed-in user (works while profile is inactive).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_account_deletion_state()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid        UUID := auth.uid();
    v_deleted_at TIMESTAMPTZ;
    v_purged     TIMESTAMPTZ;
    v_grace      INTERVAL := public.account_deletion_grace_interval();
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('isDeleted', FALSE);
    END IF;

    SELECT p.deleted_at INTO v_deleted_at
    FROM profiles p
    WHERE p.id = v_uid AND p.is_active = FALSE;

    IF v_deleted_at IS NULL THEN
        RETURN jsonb_build_object('isDeleted', FALSE);
    END IF;

    SELECT a.hard_purged_at INTO v_purged
    FROM account_deletions_audit a
    WHERE a.user_id = v_uid
    ORDER BY a.deleted_at DESC
    LIMIT 1;

    RETURN jsonb_build_object(
        'isDeleted', TRUE,
        'deletedAt', v_deleted_at,
        'graceEndsAt', v_deleted_at + v_grace,
        'canRestore',
            v_purged IS NULL
            AND v_deleted_at + v_grace > NOW(),
        'hardPurged', v_purged IS NOT NULL
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_account_deletion_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_account_deletion_state() TO authenticated;

-- ---------------------------------------------------------------------------
-- Self-service restore: caller only, fresh JWT (re-auth), within grace window.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_my_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid        UUID := auth.uid();
    v_deleted_at TIMESTAMPTZ;
    v_iat        BIGINT;
    v_grace      INTERVAL := public.account_deletion_grace_interval();
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    v_iat := NULLIF(auth.jwt()->>'iat', '')::BIGINT;
    IF v_iat IS NULL OR v_iat < EXTRACT(EPOCH FROM NOW() - INTERVAL '15 minutes')::BIGINT THEN
        RAISE EXCEPTION 'reauthentication_required' USING ERRCODE = '42501';
    END IF;

    SELECT deleted_at INTO v_deleted_at
    FROM profiles
    WHERE id = v_uid AND is_active = FALSE;

    IF v_deleted_at IS NULL THEN
        RAISE EXCEPTION 'profile_not_deleted';
    END IF;

    IF v_deleted_at + v_grace <= NOW() THEN
        RAISE EXCEPTION 'restore_window_expired' USING ERRCODE = '42501';
    END IF;

    PERFORM public.restore_deleted_account(
        v_uid,
        NULL,
        'self_service_restore:' || v_uid::text
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.restore_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_my_account() TO authenticated;

-- ---------------------------------------------------------------------------
-- Hard purge: after grace, ban auth + strip recovery email (cron / service_role).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hard_purge_expired_deleted_accounts(p_limit INT DEFAULT 200)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_grace   INTERVAL := public.account_deletion_grace_interval();
    v_purged  INT := 0;
    r         RECORD;
BEGIN
    FOR r IN
        SELECT p.id AS user_id, a.id AS audit_id
        FROM profiles p
        JOIN LATERAL (
            SELECT id, deleted_at, hard_purged_at, restored_at
            FROM account_deletions_audit
            WHERE user_id = p.id
            ORDER BY deleted_at DESC
            LIMIT 1
        ) a ON TRUE
        WHERE p.is_active = FALSE
          AND p.deleted_at IS NOT NULL
          AND p.deleted_at + v_grace <= NOW()
          AND a.restored_at IS NULL
          AND a.hard_purged_at IS NULL
        LIMIT GREATEST(p_limit, 1)
    LOOP
        UPDATE auth.users
            SET banned_until = 'infinity'::timestamptz,
                email = r.user_id::text || '@deleted.kupapay.invalid',
                raw_user_meta_data = '{}'::jsonb,
                raw_app_meta_data = '{}'::jsonb
            WHERE id = r.user_id;

        DELETE FROM auth.refresh_tokens WHERE user_id = r.user_id::text;
        DELETE FROM auth.sessions WHERE user_id = r.user_id;

        UPDATE account_deletions_audit
            SET recovery_email = NULL,
                hard_purged_at = NOW(),
                notes = COALESCE(notes, '') || ' hard_purged'
            WHERE id = r.audit_id;

        v_purged := v_purged + 1;
    END LOOP;

    RETURN v_purged;
END;
$$;

REVOKE ALL ON FUNCTION public.hard_purge_expired_deleted_accounts(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hard_purge_expired_deleted_accounts(INT) TO service_role;

-- ---------------------------------------------------------------------------
-- Admin list: prefer recovery_email from audit when auth.users is scrubbed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_deleted_accounts()
RETURNS TABLE (
    user_id               UUID,
    email                 TEXT,
    deleted_at            TIMESTAMPTZ,
    reason                TEXT,
    open_balance_snapshot JSONB,
    notes                 TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
    IF NOT public.is_app_admin() THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    WITH latest AS (
        SELECT DISTINCT ON (a.user_id)
            a.user_id,
            a.deleted_at,
            a.reason,
            a.open_balance_snapshot,
            a.notes,
            a.restored_at,
            a.hard_purged_at,
            a.recovery_email
        FROM public.account_deletions_audit a
        ORDER BY a.user_id, a.deleted_at DESC
    )
    SELECT
        l.user_id,
        COALESCE(
            NULLIF(l.recovery_email, ''),
            NULLIF(u.email, ''),
            l.user_id::text || '@unknown'
        )::TEXT,
        l.deleted_at,
        l.reason,
        l.open_balance_snapshot,
        l.notes
    FROM latest l
    JOIN auth.users u ON u.id = l.user_id
    WHERE l.restored_at IS NULL
      AND l.hard_purged_at IS NULL
    ORDER BY l.deleted_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_deleted_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_deleted_accounts() TO authenticated;

-- ---------------------------------------------------------------------------
-- has_pro: inactive (deleted) accounts are not Pro-eligible.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_pro(p_user_id UUID, p_group_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = p_user_id
              AND p.is_active = TRUE
              AND p.pro_until > NOW()
        )
        OR (
            p_group_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM public.group_passes gp
                WHERE gp.group_id = p_group_id
                  AND gp.until > NOW()
            )
        );
$$;

-- ---------------------------------------------------------------------------
-- Backfill: allow OAuth re-auth during grace for accounts banned by older deletes.
-- ---------------------------------------------------------------------------
UPDATE auth.users u
SET banned_until = NULL
FROM public.profiles p
WHERE p.id = u.id
  AND p.is_active = FALSE
  AND p.deleted_at IS NOT NULL
  AND p.deleted_at + public.account_deletion_grace_interval() > NOW()
  AND u.banned_until IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Daily hard purge (03:15 UTC).
-- ---------------------------------------------------------------------------
DO $cron$
DECLARE
    v_job_id BIGINT;
BEGIN
    SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'hard-purge-deleted-accounts-daily' LIMIT 1;
    IF v_job_id IS NOT NULL THEN
        PERFORM cron.unschedule(v_job_id);
    END IF;
END
$cron$;

SELECT cron.schedule(
    'hard-purge-deleted-accounts-daily',
    '15 3 * * *',
    $$SELECT public.hard_purge_expired_deleted_accounts(500);$$
);
