-- Harden the "Users can insert group members" RLS policy with the v3 checks
-- from account-deletion-v3-fixes.sql. The patch was never converted to a
-- migration, so prod still runs the older policy which lets a deactivated
-- caller add anyone, and lets anyone add a deactivated target.
--
-- After this migration, the policy enforces:
--   * the caller's profile is_active = TRUE   (via public.is_caller_active())
--   * the target user's profile is_active = TRUE
--   * and one of: self-insert, group creator, or already-a-member of the group
--
-- Both helper functions (is_caller_active, is_group_creator, is_group_member)
-- already exist in prod. Idempotent — re-running just rewrites the policy.

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
            auth.uid() = user_id
            OR public.is_group_creator(group_id)
            OR public.is_group_member(group_id)
        )
    );
