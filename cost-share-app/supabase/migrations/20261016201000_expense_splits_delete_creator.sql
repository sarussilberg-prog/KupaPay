-- #317 — expense_splits DELETE: expense creator only (align with INSERT / RPC path).

DROP POLICY IF EXISTS "Users can delete expense splits" ON public.expense_splits;
CREATE POLICY "Users can delete expense splits" ON public.expense_splits
    FOR DELETE
    USING (
        public.is_caller_active()
        AND EXISTS (
            SELECT 1
            FROM public.expenses e
            WHERE e.id = expense_id
              AND e.created_by = (SELECT auth.uid())
              AND public.is_group_member(e.group_id)
        )
    );
