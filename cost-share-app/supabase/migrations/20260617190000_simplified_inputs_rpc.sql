-- =============================================================================
-- 20260617190000_simplified_inputs_rpc.sql
--
-- Canonical-simplifier source RPC. Returns per (group, currency, user) nets for
-- every active group the caller is in. No pair-level math, no DISTINCT ON, no
-- simplifier — that all moves to TypeScript in @cost-share/shared.
--
-- See docs/superpowers/specs/2026-06-17-canonical-simplifier-design.md.
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
            gma.user_id,
            ROUND((
                COALESCE(p.amount, 0)
              - COALESCE(o.amount, 0)
              + COALESCE(sp.amount, 0)
              - COALESCE(sr.amount, 0)
            )::numeric, 2) AS net
        FROM activity a
        JOIN group_members_active gma ON gma.group_id = a.group_id
        LEFT JOIN paid p
            ON p.group_id = a.group_id AND p.currency = a.currency AND p.user_id = gma.user_id
        LEFT JOIN owed o
            ON o.group_id = a.group_id AND o.currency = a.currency AND o.user_id = gma.user_id
        LEFT JOIN settled_paid sp
            ON sp.group_id = a.group_id AND sp.currency = a.currency AND sp.user_id = gma.user_id
        LEFT JOIN settled_received sr
            ON sr.group_id = a.group_id AND sr.currency = a.currency AND sr.user_id = gma.user_id
    ),
    nonzero_currencies AS (
        -- Drop (group, currency) pairs where every member's net is <0.01 absolute.
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
            gma.group_id,
            jsonb_agg(
                jsonb_build_object(
                    'userId', gma.user_id,
                    'name', p.name,
                    'avatarUrl', p.avatar_url
                )
                ORDER BY p.name
            ) AS members
        FROM group_members_active gma
        JOIN profiles p ON p.id = gma.user_id
        GROUP BY gma.group_id
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
    WHERE c.currencies IS NOT NULL;  -- omit groups with zero non-zero currencies

    RETURN jsonb_build_object('groups', COALESCE(v_groups, '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_simplified_inputs(UUID) TO authenticated;
