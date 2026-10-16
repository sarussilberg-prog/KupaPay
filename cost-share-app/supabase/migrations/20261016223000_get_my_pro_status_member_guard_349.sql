-- #349 — Do not expose group pass / hasPro for groups the caller is not in.

CREATE OR REPLACE FUNCTION public.get_my_pro_status(p_group_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_member BOOLEAN;
    v_group_for_pro UUID;
BEGIN
    IF v_uid IS NULL THEN
        RETURN NULL;
    END IF;
    IF NOT public.is_caller_active() THEN
        RAISE EXCEPTION 'inactive_account' USING ERRCODE = '42501';
    END IF;

    v_member := p_group_id IS NOT NULL AND public.is_group_member(p_group_id);
    v_group_for_pro := CASE WHEN v_member THEN p_group_id ELSE NULL END;

    RETURN jsonb_build_object(
        'individualProUntil', (SELECT pro_until FROM public.profiles WHERE id = v_uid),
        'groupPassUntil', CASE
            WHEN v_member THEN (SELECT until FROM public.group_passes WHERE group_id = p_group_id)
            ELSE NULL
        END,
        'includedTripPassCredits', (
            SELECT included_trip_pass_credits FROM public.profiles WHERE id = v_uid
        ),
        'unassignedTripPassCount', (
            SELECT COUNT(*)::INT FROM public.unassigned_trip_passes WHERE user_id = v_uid
        ),
        'hasPro', public.has_pro(v_uid, v_group_for_pro),
        'adminProViewMode', COALESCE(
            CASE
                WHEN public.admin_active_pro_view_mode(v_uid) IS NULL THEN 'real'
                ELSE public.admin_active_pro_view_mode(v_uid)
            END,
            'real'
        ),
        'adminProViewExpiresAt', (
            SELECT o.expires_at
            FROM public.admin_pro_view_overrides o
            WHERE o.user_id = v_uid
              AND o.expires_at > NOW()
              AND EXISTS (SELECT 1 FROM public.app_admins a WHERE a.user_id = v_uid)
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_pro_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_pro_status(UUID) TO authenticated;
