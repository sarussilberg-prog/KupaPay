-- =============================================================================
-- 20260618100000_simplified_inputs_payer_absorbs_remainder.sql
--
-- Second hardening of get_user_simplified_inputs (after _include_footprint).
--
-- A well-formed expense always has splits summing to its amount (enforced by
-- validateExpenseSplits on write). But legacy rows, partial-write failures, or
-- direct DB edits can leave an expense whose splits don't cover its amount. The
-- unsplit remainder then has no owner, so the per-currency ledger doesn't sum to
-- zero and the simplifier throws UnbalancedLedgerError.
--
-- Fix: SELF-HEAL by attributing each expense's unsplit remainder
-- (amount - Σsplits) to the payer ("what you didn't split, you consumed
-- yourself" — the standard Splitwise behaviour). Because
--     Σ remainder = Σ amount - Σ splits = Σ paid - Σ owed   (per group, currency),
-- adding the remainder to each payer's `owed` makes the ledger ALWAYS sum to
-- zero. The user never sees a "data problem"; the numbers are simply correct.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_user_simplified_inputs(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_groups JSONB;
BEGIN
    WITH user_groups AS (
        SELECT gm.group_id
        FROM group_members gm
        JOIN groups g ON g.id = gm.group_id
        WHERE gm.user_id = p_user_id
          AND gm.is_active = TRUE
          AND g.is_active = TRUE
    ),
    group_members_active AS (
        SELECT gm.group_id, gm.user_id
        FROM group_members gm
        WHERE gm.group_id IN (SELECT group_id FROM user_groups)
          AND gm.is_active = TRUE
    ),
    paid AS (
        SELECT e.group_id, e.paid_by AS user_id, e.currency, SUM(e.amount) AS amount
        FROM expenses e
        WHERE e.group_id IN (SELECT group_id FROM user_groups)
          AND e.is_deleted = FALSE
        GROUP BY e.group_id, e.paid_by, e.currency
    ),
    owed AS (
        SELECT e.group_id, es.user_id, e.currency, SUM(es.amount) AS amount
        FROM expense_splits es
        JOIN expenses e ON e.id = es.expense_id
        WHERE e.group_id IN (SELECT group_id FROM user_groups)
          AND e.is_deleted = FALSE
        GROUP BY e.group_id, es.user_id, e.currency
    ),
    -- Unsplit remainder of each expense, attributed to its payer. Σ over the
    -- group/currency equals Σpaid - Σowed, so subtracting it balances the ledger.
    expense_remainder AS (
        SELECT e.group_id, e.paid_by AS user_id, e.currency,
               SUM(e.amount - COALESCE(s.split_sum, 0)) AS amount
        FROM expenses e
        LEFT JOIN (
            SELECT es.expense_id, SUM(es.amount) AS split_sum
            FROM expense_splits es
            GROUP BY es.expense_id
        ) s ON s.expense_id = e.id
        WHERE e.group_id IN (SELECT group_id FROM user_groups)
          AND e.is_deleted = FALSE
        GROUP BY e.group_id, e.paid_by, e.currency
    ),
    settled_paid AS (
        SELECT s.group_id, s.from_user_id AS user_id, s.currency, SUM(s.amount) AS amount
        FROM settlements s
        WHERE s.group_id IN (SELECT group_id FROM user_groups)
          AND s.deleted_at IS NULL
        GROUP BY s.group_id, s.from_user_id, s.currency
    ),
    settled_received AS (
        SELECT s.group_id, s.to_user_id AS user_id, s.currency, SUM(s.amount) AS amount
        FROM settlements s
        WHERE s.group_id IN (SELECT group_id FROM user_groups)
          AND s.deleted_at IS NULL
        GROUP BY s.group_id, s.to_user_id, s.currency
    ),
    footprint_users AS (
        SELECT group_id, user_id FROM paid
        UNION SELECT group_id, user_id FROM owed
        UNION SELECT group_id, user_id FROM settled_paid
        UNION SELECT group_id, user_id FROM settled_received
    ),
    relevant_users AS (
        SELECT group_id, user_id FROM group_members_active
        UNION
        SELECT group_id, user_id FROM footprint_users
    ),
    activity AS (
        SELECT group_id, currency FROM paid
        UNION SELECT group_id, currency FROM owed
        UNION SELECT group_id, currency FROM settled_paid
        UNION SELECT group_id, currency FROM settled_received
    ),
    per_group_currency_user AS (
        SELECT
            a.group_id,
            a.currency,
            ru.user_id,
            ROUND((
                COALESCE(p.amount, 0)
              - COALESCE(o.amount, 0)
              - COALESCE(rem.amount, 0)   -- payer absorbs unsplit remainder
              + COALESCE(sp.amount, 0)
              - COALESCE(sr.amount, 0)
            )::numeric, 2) AS net
        FROM activity a
        JOIN relevant_users ru ON ru.group_id = a.group_id
        LEFT JOIN paid p
            ON p.group_id = a.group_id AND p.currency = a.currency AND p.user_id = ru.user_id
        LEFT JOIN owed o
            ON o.group_id = a.group_id AND o.currency = a.currency AND o.user_id = ru.user_id
        LEFT JOIN expense_remainder rem
            ON rem.group_id = a.group_id AND rem.currency = a.currency AND rem.user_id = ru.user_id
        LEFT JOIN settled_paid sp
            ON sp.group_id = a.group_id AND sp.currency = a.currency AND sp.user_id = ru.user_id
        LEFT JOIN settled_received sr
            ON sr.group_id = a.group_id AND sr.currency = a.currency AND sr.user_id = ru.user_id
    ),
    nonzero_currencies AS (
        SELECT group_id, currency
        FROM per_group_currency_user
        GROUP BY group_id, currency
        HAVING MAX(ABS(net)) >= 0.01
    ),
    nets_by_currency AS (
        SELECT
            pcgu.group_id,
            pcgu.currency,
            jsonb_agg(
                jsonb_build_object('userId', pcgu.user_id, 'net', pcgu.net)
                ORDER BY pcgu.user_id
            ) AS nets
        FROM per_group_currency_user pcgu
        JOIN nonzero_currencies nc
            ON nc.group_id = pcgu.group_id AND nc.currency = pcgu.currency
        GROUP BY pcgu.group_id, pcgu.currency
    ),
    currencies_per_group AS (
        SELECT
            n.group_id,
            jsonb_agg(
                jsonb_build_object('currency', n.currency, 'nets', n.nets)
                ORDER BY n.currency
            ) AS currencies
        FROM nets_by_currency n
        GROUP BY n.group_id
    ),
    members_per_group AS (
        SELECT
            ru.group_id,
            jsonb_agg(
                jsonb_build_object(
                    'userId', ru.user_id,
                    'name', p.name,
                    'avatarUrl', p.avatar_url
                )
                ORDER BY p.name NULLS LAST, ru.user_id
            ) AS members
        FROM relevant_users ru
        JOIN profiles p ON p.id = ru.user_id
        GROUP BY ru.group_id
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'groupId', ug.group_id,
                'members', COALESCE(m.members, '[]'::jsonb),
                'currencies', COALESCE(c.currencies, '[]'::jsonb)
            )
            ORDER BY ug.group_id
        ),
        '[]'::jsonb
    )
    INTO v_groups
    FROM user_groups ug
    LEFT JOIN members_per_group m ON m.group_id = ug.group_id
    LEFT JOIN currencies_per_group c ON c.group_id = ug.group_id
    WHERE c.currencies IS NOT NULL;

    RETURN jsonb_build_object('groups', COALESCE(v_groups, '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_simplified_inputs(UUID) TO authenticated;
