-- Allow any active group member to update group metadata (name, image, currency, etc.).
-- Previously only created_by could UPDATE, so members could open Edit Group but saves failed.

DROP POLICY IF EXISTS "Group creators can update their groups" ON public.groups;
DROP POLICY IF EXISTS "Group members can update their groups" ON public.groups;

CREATE POLICY "Group members can update their groups" ON public.groups
    FOR UPDATE USING (public.is_group_member(id));
