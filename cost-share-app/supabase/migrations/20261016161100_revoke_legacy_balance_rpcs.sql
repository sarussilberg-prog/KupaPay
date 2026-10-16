-- #263 — Legacy balance RPCs were superseded by get_user_simplified_inputs (20260617200000).
-- Re-assert drop so drifted environments cannot expose IDOR dashboards.

DROP FUNCTION IF EXISTS public.get_user_dashboard(uuid);
DROP FUNCTION IF EXISTS public.get_user_balance_summary(uuid);
