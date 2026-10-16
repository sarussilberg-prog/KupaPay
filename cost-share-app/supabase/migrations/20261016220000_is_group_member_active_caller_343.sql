-- #343 — Self-deleted grace: is_group_member must imply is_caller_active (RPC + storage).

CREATE OR REPLACE FUNCTION public.is_group_member(check_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT public.is_caller_active()
       AND EXISTS (
            SELECT 1
            FROM public.group_members
            WHERE group_id = check_group_id
              AND user_id = auth.uid()
              AND is_active = TRUE
        );
$$;

CREATE OR REPLACE FUNCTION public.is_group_creator(check_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT public.is_caller_active()
       AND EXISTS (
            SELECT 1
            FROM public.groups
            WHERE id = check_group_id
              AND created_by = auth.uid()
        );
$$;

CREATE OR REPLACE FUNCTION public.get_recurring_series_for_expense(p_expense_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'seriesId', rs.id,
        'frequency', rs.frequency,
        'nextRunDate', rs.next_run_date,
        'endedAt', rs.ended_at,
        'scheduledFor', ro.scheduled_for
    )
    FROM public.recurring_expense_occurrences ro
    JOIN public.recurring_expense_series rs ON rs.id = ro.series_id
    WHERE ro.expense_id = p_expense_id
      AND public.is_caller_active()
      AND EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = rs.group_id
            AND gm.user_id = auth.uid()
            AND gm.is_active = TRUE
      );
$$;

DROP POLICY IF EXISTS "Users read own activity events" ON public.activity_events;
CREATE POLICY "Users read own activity events"
    ON public.activity_events FOR SELECT
    USING (
        user_id = auth.uid()
        AND public.is_caller_active()
    );
