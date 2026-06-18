-- =============================================================================
-- 20260617210000_simplified_inputs_include_footprint.sql
--
-- Bugfix for get_user_simplified_inputs (added in 20260617190000).
--
-- The original RPC aggregated paid/owed/settled over ALL rows but emitted a net
-- ONLY for ACTIVE members (JOIN group_members_active). Any user with financial
-- footprint who is no longer an active member — someone who left, was removed,
-- or deleted their account (kept as an inactive member with name = NULL) — had
-- their net silently dropped while the payer kept full credit. The emitted nets
-- then failed to sum to zero, simplifyDebts threw UnbalancedLedgerError, and the
-- canonical simplifier skipped the currency → every surface showed "everyone
-- settled" while a real debt still existed (the "owed 37.14 / all settled" bug).
--
-- Fix: emit nets AND members for the union of (active members) and (every user
-- with footprint in paid/owed/settled). The ledger is then guaranteed to sum to
-- zero whenever expense splits reconcile, so no real debt can be hidden.
-- Deleted-account users surface with name = NULL; the client renders them as
-- "deleted user" (i18n) via deriveSimplifiedDebts.
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
    -- Every user with any financial footprint in the group, regardless of
    -- current membership status. This is the set that MUST sum to zero.
    footprint_users AS (
        SELECT group_id, user_id FROM paid
        UNION SELECT group_id, user_id FROM owed
        UNION SELECT group_id, user_id FROM settled_paid
        UNION SELECT group_id, user_id FROM settled_received
    ),
    -- Active members (so zero-footprint actives still appear) ∪ footprint users
    -- (so a debt to/from a non-active member is never dropped).
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
              + COALESCE(sp.amount, 0)
              - COALESCE(sr.amount, 0)
            )::numeric, 2) AS net
        FROM activity a
        JOIN relevant_users ru ON ru.group_id = a.group_id
        LEFT JOIN paid p
            ON p.group_id = a.group_id AND p.currency = a.currency AND p.user_id = ru.user_id
        LEFT JOIN owed o
            ON o.group_id = a.group_id AND o.currency = a.currency AND o.user_id = ru.user_id
        LEFT JOIN settled_paid sp
            ON sp.group_id = a.group_id AND sp.currency = a.currency AND sp.user_id = ru.user_id
        LEFT JOIN settled_received sr
            ON sr.group_id = a.group_id AND sr.currency = a.currency AND sr.user_id = ru.user_id
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
    WHERE c.currencies IS NOT NULL;  -- omit groups with zero non-zero currencies

    RETURN jsonb_build_object('groups', COALESCE(v_groups, '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_simplified_inputs(UUID) TO authenticated;
