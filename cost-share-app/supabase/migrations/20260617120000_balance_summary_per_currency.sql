-- =============================================================================
-- 20260617120000_balance_summary_per_currency.sql
--
-- WHY THIS EXISTS
-- ---------------
-- The previous `get_user_balance_summary` rolled `byGroup` up at the (group,
-- currency, counterparty-pair) level: it picked one row per group via
-- `DISTINCT ON (group_id) ORDER BY ABS(net_user) DESC`. When a user had
-- offsetting balances with different counterparties in the same currency (e.g.
-- they owe Bar 7.33 IRR but Naveh owes them 7.33 IRR — per-user net 0), the
-- pair-level rollup surfaced a phantom debt that the settle-up screen — which
-- aggregates per-currency, per-user, and runs `simplifyDebts` — correctly
-- reported as zero. The two views disagreed.
--
-- FIX
-- ---
-- 1) Aggregate `user_pairwise` per (group, currency) first (SUM(net_user) across
--    counterparties), filter out rows where the absolute sum is below the
--    1-cent rounding threshold. That makes `byGroup` agree with the settle-up
--    algorithm's per-currency, per-user math.
-- 2) Within each group, return ALL non-zero currencies — the largest by
--    |net| becomes the primary entry, the rest are emitted as `others`.
--    This lets the UI render a chip stack instead of cherry-picking one
--    currency to display.
--
-- Backward compatibility: the JSON shape adds an `others` field per `byGroup`
-- entry but keeps `groupId`, `currency`, and `net` for the primary. Existing
-- clients that ignore unknown fields keep working with a corrected primary
-- value.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_user_balance_summary(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_summary JSONB;
    v_by_group JSONB;
BEGIN
    WITH user_groups AS (
        SELECT gm.group_id
        FROM group_members gm
        JOIN groups g ON g.id = gm.group_id
        WHERE gm.user_id = p_user_id
          AND gm.is_active = TRUE
          AND g.is_active = TRUE
    ),
    expense_debts AS (
        SELECT e.group_id, es.user_id AS debtor, e.paid_by AS creditor, e.currency,
               SUM(es.amount) AS amount
        FROM expense_splits es
        JOIN expenses e ON e.id = es.expense_id
        WHERE e.group_id IN (SELECT group_id FROM user_groups)
          AND e.is_deleted = FALSE
          AND es.user_id <> e.paid_by
        GROUP BY e.group_id, es.user_id, e.paid_by, e.currency
    ),
    settlement_debts AS (
        SELECT s.group_id, s.from_user_id AS debtor, s.to_user_id AS creditor, s.currency,
               SUM(s.amount) AS amount
        FROM settlements s
        WHERE s.group_id IN (SELECT group_id FROM user_groups)
          AND s.deleted_at IS NULL
        GROUP BY s.group_id, s.from_user_id, s.to_user_id, s.currency
    ),
    pair_combos AS (
        SELECT group_id, debtor, creditor, currency FROM expense_debts
        UNION SELECT group_id, creditor, debtor, currency FROM expense_debts
        UNION SELECT group_id, debtor, creditor, currency FROM settlement_debts
        UNION SELECT group_id, creditor, debtor, currency FROM settlement_debts
    ),
    directed_net AS (
        SELECT pc.group_id, pc.debtor, pc.creditor, pc.currency,
            COALESCE((SELECT ed.amount FROM expense_debts ed
                      WHERE ed.group_id = pc.group_id
                        AND ed.debtor = pc.debtor
                        AND ed.creditor = pc.creditor
                        AND ed.currency = pc.currency), 0)
          - COALESCE((SELECT sd.amount FROM settlement_debts sd
                      WHERE sd.group_id = pc.group_id
                        AND sd.debtor = pc.debtor
                        AND sd.creditor = pc.creditor
                        AND sd.currency = pc.currency), 0)
            AS gross
        FROM pair_combos pc
    ),
    pair_net AS (
        SELECT dn.group_id,
               LEAST(dn.debtor, dn.creditor) AS u_lo,
               GREATEST(dn.debtor, dn.creditor) AS u_hi,
               dn.currency,
               SUM(CASE WHEN dn.debtor < dn.creditor THEN dn.gross ELSE -dn.gross END) AS lo_to_hi
        FROM directed_net dn
        GROUP BY dn.group_id,
                 LEAST(dn.debtor, dn.creditor),
                 GREATEST(dn.debtor, dn.creditor),
                 dn.currency
    ),
    user_pairwise AS (
        SELECT pn.group_id, pn.currency,
            CASE WHEN pn.u_hi = p_user_id THEN pn.lo_to_hi ELSE -pn.lo_to_hi END AS net_user
        FROM pair_net pn
        WHERE ABS(pn.lo_to_hi) >= 0.01
          AND (pn.u_lo = p_user_id OR pn.u_hi = p_user_id)
    ),
    per_currency AS (
        SELECT currency,
            SUM(CASE WHEN net_user > 0 THEN net_user ELSE 0 END) AS owed,
            SUM(CASE WHEN net_user < 0 THEN -net_user ELSE 0 END) AS owe
        FROM user_pairwise
        GROUP BY currency
        HAVING SUM(CASE WHEN net_user > 0 THEN net_user ELSE 0 END) >= 0.01
            OR SUM(CASE WHEN net_user < 0 THEN -net_user ELSE 0 END) >= 0.01
    ),
    by_group_currency AS (
        SELECT group_id, currency, SUM(net_user) AS net_user
        FROM user_pairwise
        GROUP BY group_id, currency
        HAVING ABS(SUM(net_user)) >= 0.01
    ),
    by_group_ranked AS (
        SELECT
            group_id,
            currency,
            ROUND(net_user::numeric, 2) AS net_user,
            ROW_NUMBER() OVER (
                PARTITION BY group_id
                ORDER BY ABS(net_user) DESC, currency
            ) AS rn
        FROM by_group_currency
    ),
    by_group_primary AS (
        SELECT group_id, currency, net_user
        FROM by_group_ranked
        WHERE rn = 1
    ),
    by_group_others AS (
        SELECT group_id,
            jsonb_agg(
                jsonb_build_object('currency', currency, 'net', net_user)
                ORDER BY rn
            ) AS others
        FROM by_group_ranked
        WHERE rn > 1
        GROUP BY group_id
    )
    SELECT
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'currency', currency,
                        'owed', ROUND(owed::numeric, 2),
                        'owe', ROUND(owe::numeric, 2),
                        'net', ROUND((owed - owe)::numeric, 2)
                    )
                    ORDER BY currency
                )
                FROM per_currency
            ),
            '[]'::jsonb
        ),
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'groupId', p.group_id,
                        'currency', p.currency,
                        'net', p.net_user,
                        'others', COALESCE(o.others, '[]'::jsonb)
                    )
                    ORDER BY ABS(p.net_user) DESC
                )
                FROM by_group_primary p
                LEFT JOIN by_group_others o USING (group_id)
            ),
            '[]'::jsonb
        )
    INTO v_summary, v_by_group;

    RETURN jsonb_build_object('summary', v_summary, 'byGroup', v_by_group);
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_balance_summary(UUID) TO authenticated;
