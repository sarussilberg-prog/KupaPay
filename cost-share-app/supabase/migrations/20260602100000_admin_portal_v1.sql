-- 20260602100000_admin_portal_v1.sql
-- Admin portal v1: profiles.is_admin flag + is_app_admin() helper + 2 admin RPCs.
-- Idempotent. Safe to re-run.

-- ============================================
-- profiles.is_admin
-- ============================================
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_is_admin
    ON profiles(is_admin) WHERE is_admin = TRUE;

-- ============================================
-- Seed: bootstrap the single app admin
-- ============================================
UPDATE profiles
    SET is_admin = TRUE
    WHERE id = (
        SELECT id FROM auth.users WHERE lower(email) = 'sarussilberg@gmail.com'
    )
    AND is_admin = FALSE;

-- ============================================
-- is_app_admin() — used by every admin RPC
-- ============================================
CREATE OR REPLACE FUNCTION public.is_app_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT CASE
        WHEN auth.uid() IS NULL THEN FALSE
        ELSE COALESCE((SELECT is_admin FROM profiles WHERE id = auth.uid()), FALSE)
    END;
$$;
REVOKE EXECUTE ON FUNCTION public.is_app_admin() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;

-- ============================================
-- admin_list_deleted_accounts()
-- Latest audit row per user where restored_at IS NULL, with the original email
-- pulled from auth.users (profiles.email is scrubbed on delete).
-- ============================================
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
            a.user_id, a.deleted_at, a.reason, a.open_balance_snapshot, a.notes, a.restored_at
        FROM account_deletions_audit a
        ORDER BY a.user_id, a.deleted_at DESC
    )
    SELECT
        l.user_id,
        u.email::TEXT,
        l.deleted_at,
        l.reason,
        l.open_balance_snapshot,
        l.notes
    FROM latest l
    JOIN auth.users u ON u.id = l.user_id
    WHERE l.restored_at IS NULL
    ORDER BY l.deleted_at DESC;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_deleted_accounts() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_list_deleted_accounts() TO authenticated;

-- ============================================
-- admin_restore_deleted_account(p_user_id UUID)
-- Thin wrapper around the existing restore_deleted_account, stamping
-- 'restored_by_admin:<auth.uid()>' into the audit notes.
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_restore_deleted_account(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_admin UUID := auth.uid();
BEGIN
    IF NOT public.is_app_admin() THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;

    PERFORM public.restore_deleted_account(
        p_user_id,
        NULL,
        'restored_by_admin:' || v_admin::text
    );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_restore_deleted_account(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_restore_deleted_account(UUID) TO authenticated;
