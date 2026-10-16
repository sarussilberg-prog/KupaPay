-- #348 / group_members INSERT — avoid profiles RLS → group_members recursion on INSERT.
-- profiles_select_scoped keeps co-group EXISTS (26260); INSERT uses definer active check.

CREATE OR REPLACE FUNCTION public.profile_is_active_for_group_insert(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = p_profile_id
          AND p.is_active = TRUE
    );
$$;

REVOKE ALL ON FUNCTION public.profile_is_active_for_group_insert(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_is_active_for_group_insert(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can insert group members" ON public.group_members;
CREATE POLICY "Users can insert group members" ON public.group_members
    FOR INSERT
    WITH CHECK (
        public.is_caller_active()
        AND public.profile_is_active_for_group_insert(user_id)
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
