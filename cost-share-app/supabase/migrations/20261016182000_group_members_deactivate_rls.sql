-- #307 — group_members UPDATE: self or group creator (owner) only.

DROP POLICY IF EXISTS "Users can update group members" ON public.group_members;
CREATE POLICY "Users can update group members" ON public.group_members
    FOR UPDATE
    USING (
        public.is_caller_active()
        AND public.is_group_member(group_id)
        AND (
            user_id = (SELECT auth.uid())
            OR public.is_group_creator(group_id)
        )
    )
    WITH CHECK (
        public.is_caller_active()
        AND public.is_group_member(group_id)
        AND (
            user_id = (SELECT auth.uid())
            OR public.is_group_creator(group_id)
        )
    );
