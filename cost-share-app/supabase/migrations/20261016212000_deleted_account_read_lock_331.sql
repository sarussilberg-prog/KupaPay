-- #331 — Inactive (self-deleted) accounts must not read group financial data during grace.

DROP POLICY IF EXISTS "Users can view their groups" ON public.groups;
CREATE POLICY "Users can view their groups" ON public.groups
    FOR SELECT
    USING (public.is_caller_active() AND public.is_group_member(id));

DROP POLICY IF EXISTS "Group creators can view their groups" ON public.groups;
CREATE POLICY "Group creators can view their groups" ON public.groups
    FOR SELECT
    USING (public.is_caller_active() AND (SELECT auth.uid()) = created_by);

DROP POLICY IF EXISTS "Users can view group members" ON public.group_members;
CREATE POLICY "Users can view group members" ON public.group_members
    FOR SELECT
    USING (
        public.is_caller_active()
        AND (
            user_id = (SELECT auth.uid())
            OR public.is_group_member(group_id)
        )
    );

DROP POLICY IF EXISTS "Users can view group expenses" ON public.expenses;
CREATE POLICY "Users can view group expenses" ON public.expenses
    FOR SELECT
    USING (public.is_caller_active() AND public.is_group_member(group_id));

DROP POLICY IF EXISTS "Users can view expense splits in their groups" ON public.expense_splits;
CREATE POLICY "Users can view expense splits in their groups" ON public.expense_splits
    FOR SELECT
    USING (
        public.is_caller_active()
        AND expense_id IN (
            SELECT e.id FROM public.expenses e
            WHERE public.is_group_member(e.group_id)
        )
    );

DROP POLICY IF EXISTS "Users can view settlements in their groups" ON public.settlements;
CREATE POLICY "Users can view settlements in their groups" ON public.settlements
    FOR SELECT
    USING (public.is_caller_active() AND public.is_group_member(group_id));

DROP POLICY IF EXISTS "Users can view group messages" ON public.group_messages;
CREATE POLICY "Users can view group messages" ON public.group_messages
    FOR SELECT
    USING (public.is_caller_active() AND public.is_group_member(group_id));

DROP POLICY IF EXISTS "Members can view active batches in their groups" ON public.consolidation_batches;
CREATE POLICY "Members can view active batches in their groups"
    ON public.consolidation_batches FOR SELECT
    USING (
        public.is_caller_active()
        AND deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_id = consolidation_batches.group_id
              AND user_id = (SELECT auth.uid())
              AND is_active = TRUE
        )
    );

DROP POLICY IF EXISTS "group members read recurring series" ON public.recurring_expense_series;
CREATE POLICY "group members read recurring series"
    ON public.recurring_expense_series FOR SELECT
    TO authenticated
    USING (
        public.is_caller_active()
        AND EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = recurring_expense_series.group_id
              AND gm.user_id = (SELECT auth.uid())
              AND gm.is_active = TRUE
        )
    );

DROP POLICY IF EXISTS "group members read recurring occurrences" ON public.recurring_expense_occurrences;
CREATE POLICY "group members read recurring occurrences"
    ON public.recurring_expense_occurrences FOR SELECT
    TO authenticated
    USING (
        public.is_caller_active()
        AND EXISTS (
            SELECT 1
            FROM public.recurring_expense_series rs
            JOIN public.group_members gm ON gm.group_id = rs.group_id
            WHERE rs.id = recurring_expense_occurrences.series_id
              AND gm.user_id = (SELECT auth.uid())
              AND gm.is_active = TRUE
        )
    );

CREATE OR REPLACE FUNCTION public.get_group_messages(
    p_group_id UUID,
    p_limit INT DEFAULT 100,
    p_before TIMESTAMPTZ DEFAULT NULL
)
RETURNS SETOF public.group_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_limit INT;
BEGIN
    IF NOT public.is_caller_active() THEN
        RAISE EXCEPTION 'inactive_account' USING ERRCODE = '42501';
    END IF;
    IF NOT public.is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'not a member of group';
    END IF;

    v_limit := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200);

    RETURN QUERY
    SELECT m.*
    FROM public.group_messages m
    WHERE m.group_id = p_group_id
      AND m.is_deleted = FALSE
      AND (p_before IS NULL OR m.created_at < p_before)
    ORDER BY m.created_at DESC
    LIMIT v_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_group_messages(UUID, INT, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_messages(UUID, INT, TIMESTAMPTZ) TO authenticated;

-- Patch balance RPC (RLS alone is bypassed by SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.get_user_simplified_inputs(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_groups JSONB;
    v_caller UUID := auth.uid();
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
    END IF;

    IF NOT public.is_caller_active() THEN
        RAISE EXCEPTION 'inactive_account' USING ERRCODE = '42501';
    END IF;

    IF p_user_id IS DISTINCT FROM v_caller THEN
        IF NOT EXISTS (
            SELECT 1
            FROM group_members gm_caller
            JOIN group_members gm_target
              ON gm_target.group_id = gm_caller.group_id
            WHERE gm_caller.user_id = v_caller
              AND gm_target.user_id = p_user_id
              AND gm_caller.is_active = TRUE
              AND gm_target.is_active = TRUE
        ) THEN
            RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
        END IF;
    END IF;

    WITH user_groups AS (
        SELECT gm.group_id
        FROM group_members gm
        JOIN groups g ON g.id = gm.group_id
        WHERE gm.user_id = p_user_id
          AND gm.is_active = TRUE
          AND g.is_active = TRUE
          AND (
              p_user_id = v_caller
              OR EXISTS (
                  SELECT 1 FROM group_members gm_caller
                  WHERE gm_caller.group_id = gm.group_id
                    AND gm_caller.user_id = v_caller
                    AND gm_caller.is_active = TRUE
              )
          )
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
              - COALESCE(rem.amount, 0)
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
