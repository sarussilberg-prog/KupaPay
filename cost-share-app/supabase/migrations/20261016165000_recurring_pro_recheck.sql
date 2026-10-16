-- #266 — Skip/end recurring series when creator no longer has Pro for the group.

CREATE OR REPLACE FUNCTION public.generate_due_recurring_expenses(p_limit int DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lock boolean;
    v_created int := 0;
    v_skipped int := 0;
    v_series public.recurring_expense_series;
    v_today date := CURRENT_DATE;
BEGIN
    v_lock := pg_try_advisory_lock(8712345678901234);
    IF NOT v_lock THEN
        RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'lock_not_acquired');
    END IF;

    BEGIN
        FOR v_series IN
            SELECT *
            FROM public.recurring_expense_series
            WHERE ended_at IS NULL
              AND next_run_date <= v_today
            ORDER BY next_run_date
            LIMIT GREATEST(p_limit, 1)
            FOR UPDATE SKIP LOCKED
        LOOP
            IF NOT public.has_pro(v_series.created_by, v_series.group_id) THEN
                UPDATE public.recurring_expense_series
                SET ended_at = NOW(), updated_at = NOW()
                WHERE id = v_series.id;
                v_skipped := v_skipped + 1;
                CONTINUE;
            END IF;

            PERFORM public._insert_expense_from_recurring_series(v_series, v_series.next_run_date);

            UPDATE public.recurring_expense_series
            SET next_run_date = public._advance_recurring_next_date(v_series.next_run_date, v_series.frequency),
                updated_at = NOW()
            WHERE id = v_series.id;

            v_created := v_created + 1;
        END LOOP;
    EXCEPTION WHEN OTHERS THEN
        PERFORM pg_advisory_unlock(8712345678901234);
        RAISE;
    END;

    PERFORM pg_advisory_unlock(8712345678901234);
    RETURN jsonb_build_object('ok', true, 'created', v_created, 'ended_no_pro', v_skipped);
END;
$$;
