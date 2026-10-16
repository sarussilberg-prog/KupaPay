-- #330 — Scope profile SELECT; drop anon table access. search_users remains SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.profile_visible_to_viewer(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        auth.uid() IS NOT NULL
        AND (
            p_profile_id = auth.uid()
            OR EXISTS (
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
        );
$$;

REVOKE ALL ON FUNCTION public.profile_visible_to_viewer(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_visible_to_viewer(UUID) TO authenticated;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY profiles_select_scoped ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = (SELECT auth.uid())
        OR (
            public.is_caller_active()
            AND public.profile_visible_to_viewer(id)
        )
    );

REVOKE ALL ON TABLE public.profiles FROM anon;

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
    updated_at
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
