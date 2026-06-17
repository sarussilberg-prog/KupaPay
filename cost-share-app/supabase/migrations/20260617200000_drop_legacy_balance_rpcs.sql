-- =============================================================================
-- 20260617200000_drop_legacy_balance_rpcs.sql
--
-- Supersedes get_user_balance_summary, get_user_dashboard, and
-- get_group_pairwise_debts. Every mobile caller now reads from
-- get_user_simplified_inputs (added in 20260617190000) — the one RPC the
-- canonical-simplifier pipeline consumes.
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_user_balance_summary(uuid);
DROP FUNCTION IF EXISTS public.get_user_dashboard(uuid);
DROP FUNCTION IF EXISTS public.get_group_pairwise_debts(uuid);
