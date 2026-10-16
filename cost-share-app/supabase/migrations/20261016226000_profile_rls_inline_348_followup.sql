-- #348 follow-up — RLS uses SECURITY DEFINER helper (no EXECUTE for authenticated; avoids recursion).

DROP POLICY IF EXISTS profiles_select_scoped ON public.profiles;

CREATE POLICY profiles_select_scoped ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        profiles.id = (SELECT auth.uid())
        OR (
            public.is_caller_active()
            AND public.profile_visible_to_viewer(profiles.id)
        )
    );
