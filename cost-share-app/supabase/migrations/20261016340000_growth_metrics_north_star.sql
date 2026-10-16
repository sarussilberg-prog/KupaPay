-- Growth metrics (#422): north-star groups (≥2 members adding expenses per calendar month).
-- Admin RPC mirrors PostHog north-star definition using authoritative expense rows (no PII).

CREATE OR REPLACE VIEW public.analytics_north_star_groups AS
SELECT
    date_trunc('month', e.created_at AT TIME ZONE 'UTC') AS month_start,
    e.group_id,
    COUNT(DISTINCT e.created_by) AS distinct_expense_authors
FROM public.expenses e
WHERE COALESCE(e.is_deleted, FALSE) = FALSE
GROUP BY 1, 2
HAVING COUNT(DISTINCT e.created_by) >= 2;

REVOKE ALL ON public.analytics_north_star_groups FROM PUBLIC;
REVOKE ALL ON public.analytics_north_star_groups FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_growth_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now_month TIMESTAMPTZ := date_trunc('month', NOW() AT TIME ZONE 'UTC');
    v_prev_month TIMESTAMPTZ := v_now_month - INTERVAL '1 month';
    v_north_star_current BIGINT;
    v_north_star_previous BIGINT;
    v_mau_expense_authors BIGINT;
    v_wau_expense_authors BIGINT;
    v_dau_expense_authors BIGINT;
    v_monthly_series JSONB;
BEGIN
    IF NOT is_app_admin() THEN
        RAISE EXCEPTION 'not_admin';
    END IF;

    SELECT COUNT(*) INTO v_north_star_current
    FROM analytics_north_star_groups
    WHERE month_start = v_now_month;

    SELECT COUNT(*) INTO v_north_star_previous
    FROM analytics_north_star_groups
    WHERE month_start = v_prev_month;

    SELECT COUNT(DISTINCT e.created_by) INTO v_mau_expense_authors
    FROM expenses e
    WHERE COALESCE(e.is_deleted, FALSE) = FALSE
      AND e.created_at >= v_now_month;

    SELECT COUNT(DISTINCT e.created_by) INTO v_wau_expense_authors
    FROM expenses e
    WHERE COALESCE(e.is_deleted, FALSE) = FALSE
      AND e.created_at >= NOW() - INTERVAL '7 days';

    SELECT COUNT(DISTINCT e.created_by) INTO v_dau_expense_authors
    FROM expenses e
    WHERE COALESCE(e.is_deleted, FALSE) = FALSE
      AND e.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC');

    SELECT COALESCE(jsonb_agg(row ORDER BY row->>'month'), '[]'::JSONB)
    INTO v_monthly_series
    FROM (
        SELECT jsonb_build_object(
            'month', TO_CHAR(month_start, 'YYYY-MM'),
            'north_star_groups', COUNT(*)
        ) AS row
        FROM analytics_north_star_groups
        WHERE month_start >= v_now_month - INTERVAL '12 months'
        GROUP BY month_start
    ) s;

    RETURN jsonb_build_object(
        'as_of', TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'north_star', jsonb_build_object(
            'definition', 'monthly_active_groups_with_two_plus_expense_authors',
            'current_month', TO_CHAR(v_now_month, 'YYYY-MM'),
            'current_month_count', v_north_star_current,
            'previous_month', TO_CHAR(v_prev_month, 'YYYY-MM'),
            'previous_month_count', v_north_star_previous
        ),
        'active_expense_authors', jsonb_build_object(
            'dau', v_dau_expense_authors,
            'wau', v_wau_expense_authors,
            'mau', v_mau_expense_authors,
            'note', 'Distinct users who created a non-deleted expense in the window; complement PostHog MAU from app_open/signup.'
        ),
        'north_star_monthly_series', v_monthly_series
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_growth_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_growth_metrics() TO authenticated;
