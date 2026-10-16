-- Admin-only Pro view override (Real / Force Pro / Force Free) for QA — dev testing.
-- Does not mutate RevenueCat entitlements or affect non-admin users.

CREATE TABLE IF NOT EXISTS public.admin_pro_view_overrides (
    user_id     UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    mode        TEXT NOT NULL CHECK (mode IN ('force_pro', 'force_free')),
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.admin_pro_view_overrides IS
    'Per-app-admin Pro gating override for self-testing only; honored in has_pro / get_my_pro_status.';

CREATE TRIGGER update_admin_pro_view_overrides_updated_at
    BEFORE UPDATE ON public.admin_pro_view_overrides
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.admin_pro_view_overrides ENABLE ROW LEVEL SECURITY;

-- No policies: reachable only via SECURITY DEFINER helpers (same pattern as app_admins).

CREATE OR REPLACE FUNCTION public.admin_active_pro_view_mode(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT o.mode
    FROM public.admin_pro_view_overrides o
    WHERE o.user_id = p_user_id
      AND o.expires_at > NOW()
      AND EXISTS (SELECT 1 FROM public.app_admins a WHERE a.user_id = p_user_id);
$$;

REVOKE ALL ON FUNCTION public.admin_active_pro_view_mode(UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.has_pro(p_user_id UUID, p_group_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE public.admin_active_pro_view_mode(p_user_id)
        WHEN 'force_pro' THEN TRUE
        WHEN 'force_free' THEN FALSE
        ELSE (
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
            )
        )
    END;
$$;

REVOKE ALL ON FUNCTION public.has_pro(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_pro(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_pro_status(p_group_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'individualProUntil', (SELECT pro_until FROM public.profiles WHERE id = auth.uid()),
        'groupPassUntil', CASE
            WHEN p_group_id IS NULL THEN NULL
            ELSE (SELECT until FROM public.group_passes WHERE group_id = p_group_id)
        END,
        'includedTripPassCredits', (
            SELECT included_trip_pass_credits FROM public.profiles WHERE id = auth.uid()
        ),
        'unassignedTripPassCount', (
            SELECT COUNT(*)::INT FROM public.unassigned_trip_passes WHERE user_id = auth.uid()
        ),
        'hasPro', public.has_pro(auth.uid(), p_group_id),
        'adminProViewMode', COALESCE(
            CASE
                WHEN public.admin_active_pro_view_mode(auth.uid()) IS NULL THEN 'real'
                ELSE public.admin_active_pro_view_mode(auth.uid())
            END,
            'real'
        ),
        'adminProViewExpiresAt', (
            SELECT o.expires_at
            FROM public.admin_pro_view_overrides o
            WHERE o.user_id = auth.uid()
              AND o.expires_at > NOW()
              AND EXISTS (SELECT 1 FROM public.app_admins a WHERE a.user_id = auth.uid())
        )
    );
$$;

REVOKE ALL ON FUNCTION public.get_my_pro_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_pro_status(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_my_admin_pro_view_mode(
    p_mode TEXT,
    p_duration_hours INT DEFAULT 24
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_hours INT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    IF NOT public.is_app_admin() THEN
        RAISE EXCEPTION 'not_authorized';
    END IF;

    IF p_mode NOT IN ('real', 'force_pro', 'force_free') THEN
        RAISE EXCEPTION 'invalid_mode';
    END IF;

    v_hours := GREATEST(1, LEAST(COALESCE(p_duration_hours, 24), 168));

    IF p_mode = 'real' THEN
        DELETE FROM public.admin_pro_view_overrides WHERE user_id = v_uid;
    ELSE
        INSERT INTO public.admin_pro_view_overrides (user_id, mode, expires_at)
        VALUES (v_uid, p_mode, NOW() + (v_hours || ' hours')::INTERVAL)
        ON CONFLICT (user_id) DO UPDATE SET
            mode = EXCLUDED.mode,
            expires_at = EXCLUDED.expires_at,
            updated_at = NOW();
    END IF;

    RETURN public.get_my_pro_status(NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_admin_pro_view_mode(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_admin_pro_view_mode(TEXT, INT) TO authenticated;
