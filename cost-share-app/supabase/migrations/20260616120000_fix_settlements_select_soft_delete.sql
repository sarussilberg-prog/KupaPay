-- =============================================================================
-- 20260616120000_fix_settlements_select_soft_delete.sql
--
-- WHY THIS EXISTS
-- ---------------
-- Soft-deleting a settlement (UPDATE settlements SET deleted_at = now()) failed
-- with HTTP 403 / "new row violates row-level security policy for table
-- settlements" (SQLSTATE 42501).
--
-- Root cause: the SELECT policy was
--     USING (is_group_member(group_id) AND deleted_at IS NULL)
-- PostgREST runs UPDATEs with a RETURNING clause, so PostgreSQL enforces the
-- SELECT policy against the *post-update* row. Once deleted_at is set the new
-- row no longer satisfies `deleted_at IS NULL`, the SELECT policy rejects it,
-- and the whole UPDATE is denied. (expenses soft-delete works because its
-- SELECT policy is just is_group_member(group_id) and does not filter the
-- soft-delete flag.) A previous attempt fixed the UPDATE policy instead of the
-- SELECT policy, so it never resolved the issue.
--
-- Fix: drop the `deleted_at IS NULL` clause from the SELECT policy, matching the
-- expenses pattern. Every application read path and get_group_pairwise_debts
-- already filter `deleted_at IS NULL` explicitly, so soft-deleted settlements
-- stay excluded from balances/debts — calculations are unaffected.
-- =============================================================================

DROP POLICY IF EXISTS "Users can view settlements in their groups" ON settlements;
CREATE POLICY "Users can view settlements in their groups" ON settlements
    FOR SELECT USING (public.is_group_member(group_id));
