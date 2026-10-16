-- Reassert profiles column GRANTs + scoped SELECT policy (dev regression: PostgREST 42501).
-- Root cause: column-level privileges require explicit column lists; select=* is denied.
-- Idempotent repair if a partial security deploy dropped authenticated table/column access.

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

REVOKE ALL ON FUNCTION public.profile_visible_to_viewer(UUID) FROM PUBLIC;
-- #348: not a client oracle; RLS only.

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS profiles_select_scoped ON public.profiles;

CREATE POLICY profiles_select_scoped ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = (SELECT auth.uid())
        OR (
            public.is_caller_active()
            AND (
                EXISTS (
                    SELECT 1 FROM public.friendships f
                    WHERE f.user_a_id = LEAST((SELECT auth.uid()), id)
                      AND f.user_b_id = GREATEST((SELECT auth.uid()), id)
                )
                OR EXISTS (
                    SELECT 1
                    FROM public.group_members gm_self
                    JOIN public.group_members gm_peer
                      ON gm_peer.group_id = gm_self.group_id
                    WHERE gm_self.user_id = (SELECT auth.uid())
                      AND gm_self.is_active = TRUE
                      AND gm_peer.user_id = id
                      AND gm_peer.is_active = TRUE
                )
                OR EXISTS (
                    SELECT 1
                    FROM public.friend_requests fr
                    WHERE fr.status = 'pending'
                      AND (
                          (fr.from_user_id = (SELECT auth.uid()) AND fr.to_user_id = id)
                          OR (fr.to_user_id = (SELECT auth.uid()) AND fr.from_user_id = id)
                      )
                )
            )
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
