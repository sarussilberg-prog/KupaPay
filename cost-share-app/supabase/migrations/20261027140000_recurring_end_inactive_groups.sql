-- End active recurring series when their group is deactivated or split members are invalid,
-- even if next_run_date is still in the future (dispatch must not leave zombie series).

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
    v_ended_inactive int := 0;
    v_ended_invalid int := 0;
    v_series public.recurring_expense_series;
    v_today date;
    v_run_date date;
    v_budget int := GREATEST(p_limit, 1);
BEGIN
    v_lock := pg_try_advisory_lock(8712345678901234);
    IF NOT v_lock THEN
        RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'lock_not_acquired');
    END IF;

    BEGIN
        WITH ended AS (
            UPDATE public.recurring_expense_series rs
            SET ended_at = NOW(), updated_at = NOW()
            WHERE rs.ended_at IS NULL
              AND NOT COALESCE(
                  (SELECT g.is_active FROM public.groups g WHERE g.id = rs.group_id),
                  FALSE
              )
            RETURNING rs.id
        )
        SELECT COUNT(*)::int INTO v_ended_inactive FROM ended;

        WITH ended AS (
            UPDATE public.recurring_expense_series rs
            SET ended_at = NOW(), updated_at = NOW()
            WHERE rs.ended_at IS NULL
              AND public._recurring_series_has_invalid_members(rs)
            RETURNING rs.id
        )
        SELECT COUNT(*)::int INTO v_ended_invalid FROM ended;

        FOR v_series IN
            SELECT rs.*
            FROM public.recurring_expense_series rs
            WHERE rs.ended_at IS NULL
              AND rs.next_run_date <= public._recurring_local_today(rs.timezone_hint)
            ORDER BY rs.next_run_date
            FOR UPDATE SKIP LOCKED
        LOOP
            IF v_created >= v_budget THEN
                EXIT;
            END IF;

            IF NOT COALESCE(
                (SELECT g.is_active FROM public.groups g WHERE g.id = v_series.group_id),
                FALSE
            ) THEN
                UPDATE public.recurring_expense_series
                SET ended_at = NOW(), updated_at = NOW()
                WHERE id = v_series.id;
                v_ended_inactive := v_ended_inactive + 1;
                CONTINUE;
            END IF;

            IF NOT public.has_pro(v_series.created_by, v_series.group_id) THEN
                UPDATE public.recurring_expense_series
                SET ended_at = NOW(), updated_at = NOW()
                WHERE id = v_series.id;
                v_skipped := v_skipped + 1;
                CONTINUE;
            END IF;

            v_today := public._recurring_local_today(v_series.timezone_hint);
            v_run_date := v_series.next_run_date;

            WHILE v_run_date <= v_today AND v_created < v_budget LOOP
                BEGIN
                    PERFORM public._insert_expense_from_recurring_series(v_series, v_run_date);
                EXCEPTION
                    WHEN OTHERS THEN
                        IF SQLERRM LIKE '%recurring_series_invalid_members%' THEN
                            v_skipped := v_skipped + 1;
                            EXIT;
                        END IF;
                        RAISE;
                END;

                v_run_date := public._advance_recurring_next_date(v_run_date, v_series.frequency);
                v_created := v_created + 1;
            END LOOP;

            UPDATE public.recurring_expense_series
            SET next_run_date = v_run_date,
                updated_at = NOW()
            WHERE id = v_series.id;

            SELECT * INTO v_series FROM public.recurring_expense_series WHERE id = v_series.id;
        END LOOP;
    EXCEPTION WHEN OTHERS THEN
        PERFORM pg_advisory_unlock(8712345678901234);
        RAISE;
    END;

    PERFORM pg_advisory_unlock(8712345678901234);
    RETURN jsonb_build_object(
        'ok', true,
        'created', v_created,
        'ended_no_pro', v_skipped,
        'ended_inactive_group', v_ended_inactive,
        'ended_invalid_members', v_ended_invalid
    );
END;
$$;
