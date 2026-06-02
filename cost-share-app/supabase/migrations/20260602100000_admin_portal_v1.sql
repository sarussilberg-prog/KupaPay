-- 20260602100000_admin_portal_v1.sql
-- Admin portal v1: app_admins table + is_app_admin() helper + 2 admin RPCs.
-- Idempotent. Safe to re-run.
--
-- Why a dedicated table (not a column on profiles):
--   profiles has permissive RLS (own-row UPDATE, public SELECT). Adding
--   is_admin there would let users self-promote and let anyone enumerate
--   admins. A dedicated table with no RLS policies is reachable only by
--   service_role and SECURITY DEFINER functions.

-- ============================================
-- app_admins
-- ============================================
CREATE TABLE IF NOT EXISTS public.app_admins (
    user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
-- No RLS policies on purpose: only service_role and SECURITY DEFINER funcs reach it.

-- ============================================
-- Seed: bootstrap the single app admin
-- ============================================
INSERT INTO public.app_admins (user_id)
SELECT id FROM auth.users WHERE lower(email) = 'sarussilberg@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- is_app_admin() — used by every admin RPC and by the mobile client
-- ============================================
CREATE OR REPLACE FUNCTION public.is_app_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT CASE
        WHEN auth.uid() IS NULL THEN FALSE
        ELSE EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid())
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
        FROM public.account_deletions_audit a
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
