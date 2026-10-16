-- #344 — Pending friend requests: allow profile SELECT for request parties.

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
