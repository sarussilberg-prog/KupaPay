-- Fix ambiguous `currency` in _get_group_pairwise_debts_core (42702) when OUT params
-- share names with CTE columns. Regression covered by get_group_pairwise_debts.test.sql.

CREATE OR REPLACE FUNCTION public._get_group_pairwise_debts_core(p_group_id UUID)
RETURNS TABLE (
    from_user_id UUID,
    to_user_id UUID,
    currency VARCHAR,
    amount NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
    RETURN QUERY
    WITH expense_debts AS (
        SELECT es.user_id AS debtor, e.paid_by AS creditor, e.currency, SUM(es.amount) AS amount
        FROM expense_splits es
        JOIN expenses e ON e.id = es.expense_id
        WHERE e.group_id = p_group_id
          AND e.is_deleted = FALSE
          AND es.user_id <> e.paid_by
        GROUP BY es.user_id, e.paid_by, e.currency
    ),
    settlement_debts AS (
        SELECT s.from_user_id AS debtor, s.to_user_id AS creditor, s.currency, SUM(s.amount) AS amount
        FROM settlements s
        WHERE s.group_id = p_group_id
          AND s.deleted_at IS NULL
        GROUP BY s.from_user_id, s.to_user_id, s.currency
    ),
    pair_combos AS (
        SELECT debtor, creditor, currency FROM expense_debts
        UNION
        SELECT creditor, debtor, currency FROM expense_debts
        UNION
        SELECT debtor, creditor, currency FROM settlement_debts
        UNION
        SELECT creditor, debtor, currency FROM settlement_debts
    ),
    directed_net AS (
        SELECT
            pc.debtor,
            pc.creditor,
            pc.currency,
            COALESCE((SELECT ed.amount FROM expense_debts ed
                      WHERE ed.debtor = pc.debtor AND ed.creditor = pc.creditor AND ed.currency = pc.currency), 0)
            - COALESCE((SELECT sd.amount FROM settlement_debts sd
                      WHERE sd.debtor = pc.debtor AND sd.creditor = pc.creditor AND sd.currency = pc.currency), 0)
            AS gross
        FROM pair_combos pc
    ),
    pair_net AS (
        SELECT
            LEAST(d1.debtor, d1.creditor) AS u_lo,
            GREATEST(d1.debtor, d1.creditor) AS u_hi,
            d1.currency AS cur,
            SUM(CASE WHEN d1.debtor < d1.creditor THEN d1.gross ELSE -d1.gross END) AS lo_to_hi
        FROM directed_net d1
        GROUP BY LEAST(d1.debtor, d1.creditor), GREATEST(d1.debtor, d1.creditor), d1.currency
    )
    SELECT
        CASE WHEN pn.lo_to_hi > 0 THEN pn.u_lo ELSE pn.u_hi END AS from_user_id,
        CASE WHEN pn.lo_to_hi > 0 THEN pn.u_hi ELSE pn.u_lo END AS to_user_id,
        pn.cur,
        ROUND(ABS(pn.lo_to_hi)::numeric, 2) AS amount
    FROM pair_net pn
    WHERE ABS(pn.lo_to_hi) >= 0.01;
END;
$$;
