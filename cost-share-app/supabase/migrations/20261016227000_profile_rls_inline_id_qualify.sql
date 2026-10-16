-- Fix ambiguous "id" in profiles_select_scoped (#348 follow-up).

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
                    FROM public.group_members gm_self
                    JOIN public.group_members gm_peer
                      ON gm_peer.group_id = gm_self.group_id
                    WHERE gm_self.user_id = auth.uid()
                      AND gm_self.is_active = TRUE
                      AND gm_peer.user_id = profiles.id
                      AND gm_peer.is_active = TRUE
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
