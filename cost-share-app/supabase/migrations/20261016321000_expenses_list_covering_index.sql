-- Round 11 perf — GroupDetail expenses list: group_id filter + created_at DESC (no seq scan at scale).

CREATE INDEX IF NOT EXISTS idx_expenses_group_active_created_desc
    ON public.expenses (group_id, created_at DESC)
    WHERE is_deleted = FALSE;
