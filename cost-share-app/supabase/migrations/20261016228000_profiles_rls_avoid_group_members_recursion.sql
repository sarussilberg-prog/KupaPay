-- Break profiles ↔ group_members RLS recursion introduced by inline profiles policies (#348).

CREATE OR REPLACE FUNCTION public.is_user_profile_active(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = p_user_id
          AND p.is_active = TRUE
    );
$$;

REVOKE EXECUTE ON FUNCTION public.is_user_profile_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_user_profile_active(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS profiles_select_scoped ON public.profiles;

CREATE POLICY profiles_select_scoped ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        profiles.id = (SELECT auth.uid())
        OR (
            public.is_caller_active()
            AND (
                EXISTS (
                    SELECT 1 FROM public.friendships f
                    WHERE f.user_a_id = LEAST(auth.uid(), profiles.id)
                      AND f.user_b_id = GREATEST(auth.uid(), profiles.id)
                )
                OR EXISTS (
                    SELECT 1
                    FROM public.group_members gm_peer
                    WHERE gm_peer.user_id = profiles.id
                      AND gm_peer.is_active = TRUE
                      AND public.is_group_member(gm_peer.group_id)
                )
                OR EXISTS (
                    SELECT 1
                    FROM public.friend_requests fr
                    WHERE fr.status = 'pending'
                      AND (
                          (fr.from_user_id = auth.uid() AND fr.to_user_id = profiles.id)
                          OR (fr.to_user_id = auth.uid() AND fr.from_user_id = profiles.id)
                      )
                )
            )
        )
    );

DROP POLICY IF EXISTS "Users can insert group members" ON public.group_members;

CREATE POLICY "Users can insert group members" ON public.group_members
    FOR INSERT
    WITH CHECK (
        public.is_caller_active()
        AND public.is_user_profile_active(user_id)
        AND (
            auth.uid() = user_id
            OR public.is_group_creator(group_id)
            OR public.is_group_member(group_id)
        )
    );
