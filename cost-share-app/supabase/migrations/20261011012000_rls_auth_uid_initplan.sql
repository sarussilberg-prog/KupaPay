-- RLS initplan: wrap remaining auth.uid() policy expressions as (select auth.uid()).

-- Profiles / group_members insert / settlement delete initplan lives in
-- 20261011010000_security_hardening.sql (includes is_caller_active gates).

DROP POLICY IF EXISTS "Users can view group members" ON public.group_members;
CREATE POLICY "Users can view group members" ON public.group_members
    FOR SELECT USING (
        user_id = (select auth.uid()) OR public.is_group_member(group_id)
    );

DROP POLICY IF EXISTS "Users can update group members" ON public.group_members;
CREATE POLICY "Users can update group members" ON public.group_members
    FOR UPDATE USING (public.is_group_member(group_id) AND public.is_caller_active());

DROP POLICY IF EXISTS "Users read own activity events" ON public.activity_events;
CREATE POLICY "Users read own activity events"
    ON public.activity_events FOR SELECT
    USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS activity_events_delete_own ON public.activity_events;
CREATE POLICY activity_events_delete_own
    ON public.activity_events FOR DELETE
    TO authenticated
    USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users read own group last seen" ON public.activity_group_last_seen;
CREATE POLICY "Users read own group last seen"
    ON public.activity_group_last_seen FOR SELECT
    TO authenticated
    USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users read own notification prefs" ON public.notification_preferences;
CREATE POLICY "Users read own notification prefs" ON public.notification_preferences
    FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users insert own notification prefs" ON public.notification_preferences;
CREATE POLICY "Users insert own notification prefs" ON public.notification_preferences
    FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users update own notification prefs" ON public.notification_preferences;
CREATE POLICY "Users update own notification prefs" ON public.notification_preferences
    FOR UPDATE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users read own device tokens" ON public.device_tokens;
CREATE POLICY "Users read own device tokens" ON public.device_tokens
    FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users insert own device tokens" ON public.device_tokens;
CREATE POLICY "Users insert own device tokens" ON public.device_tokens
    FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users update own device tokens" ON public.device_tokens;
CREATE POLICY "Users update own device tokens" ON public.device_tokens
    FOR UPDATE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users delete own device tokens" ON public.device_tokens;
CREATE POLICY "Users delete own device tokens" ON public.device_tokens
    FOR DELETE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view their own archive rows" ON public.group_user_archive;
CREATE POLICY "Users can view their own archive rows" ON public.group_user_archive
    FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own archive rows" ON public.group_user_archive;
CREATE POLICY "Users can insert their own archive rows" ON public.group_user_archive
    FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own archive rows" ON public.group_user_archive;
CREATE POLICY "Users can delete their own archive rows" ON public.group_user_archive
    FOR DELETE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "admins read monetization events" ON public.monetization_events;
CREATE POLICY "admins read monetization events"
    ON public.monetization_events FOR SELECT
    TO authenticated
    USING (public.is_app_admin());
