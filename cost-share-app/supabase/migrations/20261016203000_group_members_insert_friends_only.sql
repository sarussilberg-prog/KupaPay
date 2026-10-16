-- #320 — group_members INSERT: self, or friends (matches AddMembersSheet UX); not arbitrary users.

DROP POLICY IF EXISTS "Users can insert group members" ON public.group_members;
CREATE POLICY "Users can insert group members" ON public.group_members
    FOR INSERT
    WITH CHECK (
        public.is_caller_active()
        AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = user_id
              AND p.is_active = TRUE
        )
        AND (
            user_id = (SELECT auth.uid())
            OR (
                (public.is_group_creator(group_id) OR public.is_group_member(group_id))
                AND EXISTS (
                    SELECT 1 FROM public.friendships f
                    WHERE f.user_a_id = LEAST((SELECT auth.uid()), user_id)
                      AND f.user_b_id = GREATEST((SELECT auth.uid()), user_id)
                )
            )
        )
    );
