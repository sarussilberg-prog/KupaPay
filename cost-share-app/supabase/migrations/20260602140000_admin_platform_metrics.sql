-- 20260602140000_admin_platform_metrics.sql
-- Platform metrics for admin portal + shared auto-archive predicate.

CREATE OR REPLACE FUNCTION public.group_is_auto_archived(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH g AS (
        SELECT id, last_activity_at
        FROM groups
        WHERE id = p_group_id AND is_active = TRUE
    ),
    members AS (
        SELECT gm.user_id
        FROM group_members gm
        WHERE gm.group_id = p_group_id AND gm.is_active = TRUE
    ),
    paid AS (
        SELECT e.paid_by AS user_id, e.currency, SUM(e.amount) AS amount
        FROM expenses e
        WHERE e.group_id = p_group_id AND e.is_deleted = FALSE
        GROUP BY e.paid_by, e.currency
    ),
    owed AS (
        SELECT es.user_id, e.currency, SUM(es.amount) AS amount
        FROM expense_splits es
        JOIN expenses e ON e.id = es.expense_id
        WHERE e.group_id = p_group_id AND e.is_deleted = FALSE
        GROUP BY es.user_id, e.currency
    ),
    settled_in AS (
        SELECT s.to_user_id AS user_id, s.currency, SUM(s.amount) AS amount
        FROM settlements s
        WHERE s.group_id = p_group_id AND s.deleted_at IS NULL
        GROUP BY s.to_user_id, s.currency
    ),
    settled_out AS (
        SELECT s.from_user_id AS user_id, s.currency, SUM(s.amount) AS amount
        FROM settlements s
        WHERE s.group_id = p_group_id AND s.deleted_at IS NULL
        GROUP BY s.from_user_id, s.currency
    ),
    currency_keys AS (
        SELECT user_id, currency FROM paid
        UNION SELECT user_id, currency FROM owed
        UNION SELECT user_id, currency FROM settled_in
        UNION SELECT user_id, currency FROM settled_out
    ),
    member_balances AS (
        SELECT ck.user_id, ck.currency,
            COALESCE(p.amount, 0) - COALESCE(o.amount, 0)
              + COALESCE(si.amount, 0) - COALESCE(so.amount, 0) AS net
        FROM currency_keys ck
        LEFT JOIN paid p ON p.user_id = ck.user_id AND p.currency = ck.currency
        LEFT JOIN owed o ON o.user_id = ck.user_id AND o.currency = ck.currency
        LEFT JOIN settled_in si ON si.user_id = ck.user_id AND si.currency = ck.currency
        LEFT JOIN settled_out so ON so.user_id = ck.user_id AND so.currency = ck.currency
        WHERE EXISTS (SELECT 1 FROM members m WHERE m.user_id = ck.user_id)
    ),
    all_settled AS (
        SELECT NOT EXISTS (
            SELECT 1 FROM member_balances mb WHERE ABS(mb.net) >= 0.01
        ) AS v
    )
    SELECT EXISTS (
        SELECT 1 FROM g
        CROSS JOIN all_settled a
        WHERE g.last_activity_at < (NOW() - INTERVAL '2 months')
          AND COALESCE(a.v, TRUE)
    );
$$;

REVOKE EXECUTE ON FUNCTION public.group_is_auto_archived(UUID) FROM PUBLIC;
-- Not granted to authenticated: only SECURITY DEFINER callers use it.
