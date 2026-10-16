-- Repair dev drift: 20261016230000 may have been applied before it gained the
-- profiles_select_scoped policy (grants-only revision). Remote DBs can still
-- reference public.profile_visible_to_viewer after EXECUTE was revoked (#348),
-- which breaks self-profile reads (42501) and leaves the app on "Group member".

CREATE OR REPLACE FUNCTION app_private.profile_peer_visible_for_rls(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
    SELECT
        auth.uid() IS NOT NULL
        AND p_profile_id IS DISTINCT FROM auth.uid()
        AND (
            EXISTS (
                SELECT 1 FROM public.friendships f
                WHERE f.user_a_id = LEAST(auth.uid(), p_profile_id)
                  AND f.user_b_id = GREATEST(auth.uid(), p_profile_id)
            )
            OR EXISTS (
                SELECT 1
                FROM public.group_members gm_self
                JOIN public.group_members gm_peer
                  ON gm_peer.group_id = gm_self.group_id
                WHERE gm_self.user_id = auth.uid()
                  AND gm_self.is_active = TRUE
                  AND gm_peer.user_id = p_profile_id
                  AND gm_peer.is_active = TRUE
            )
            OR EXISTS (
                SELECT 1
                FROM public.friend_requests fr
                WHERE fr.status = 'pending'
                  AND (
                      (fr.from_user_id = auth.uid() AND fr.to_user_id = p_profile_id)
                      OR (fr.to_user_id = auth.uid() AND fr.from_user_id = p_profile_id)
                  )
            )
        );
$$;

REVOKE ALL ON FUNCTION app_private.profile_peer_visible_for_rls(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.profile_peer_visible_for_rls(UUID) TO authenticated;

ALTER FUNCTION public.is_caller_active() SET row_security = off;

DROP POLICY IF EXISTS profiles_select_scoped ON public.profiles;

CREATE POLICY profiles_select_scoped ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        profiles.id = (SELECT auth.uid())
        OR (
            public.is_caller_active()
            AND app_private.profile_peer_visible_for_rls(profiles.id)
        )
    );

REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;

GRANT SELECT (
    id,
    email,
    name,
    phone,
    avatar_url,
    default_currency,
    language,
    is_active,
    created_at,
    updated_at,
    activity_last_seen_at
) ON TABLE public.profiles TO authenticated;

GRANT UPDATE (
    name,
    email,
    phone,
    avatar_url,
    default_currency,
    language,
    updated_at
) ON TABLE public.profiles TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_user_simplified_inputs(UUID) TO authenticated;
