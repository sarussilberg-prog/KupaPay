-- Security: #201 IDOR on get_user_simplified_inputs, #204 settle reminder rate limit, #205 support spam limit.

-- ---------------------------------------------------------------------------
-- #201 — Caller must be authenticated; cross-user reads only for shared groups.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_simplified_inputs(p_user_id UUID)
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

-- ---------------------------------------------------------------------------
-- #204 — Cap settle-up reminders per sender/recipient/group (24h window).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION send_settle_reminder(
    p_group_id    UUID,
    p_to_user_id  UUID,
    p_message     TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_recent INT;
BEGIN
    IF NOT is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'not_group_member';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = p_group_id
          AND user_id = p_to_user_id
          AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'recipient_not_group_member';
    END IF;
    IF p_to_user_id = auth.uid() THEN
        RAISE EXCEPTION 'cannot_remind_self';
    END IF;

    SELECT COUNT(*)::INT INTO v_recent
    FROM activity_events
    WHERE kind = 'settle_up_reminder'
      AND group_id = p_group_id
      AND user_id = p_to_user_id
      AND actor_user_id = auth.uid()
      AND created_at > NOW() - INTERVAL '24 hours';

    IF v_recent >= 5 THEN
        RAISE EXCEPTION 'settle_reminder_rate_limit_exceeded' USING ERRCODE = '42501';
    END IF;

    INSERT INTO activity_events (
        id, user_id, kind, group_id, ref_id, actor_user_id, metadata
    ) VALUES (
        gen_random_uuid(),
        p_to_user_id,
        'settle_up_reminder',
        p_group_id,
        gen_random_uuid(),
        auth.uid(),
        jsonb_build_object('body', p_message)
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- #205 — Support form spam: max 5 rows per normalized email per hour.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_support_message_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*)::INT INTO v_count
    FROM public.support_messages
    WHERE lower(btrim(email)) = lower(btrim(NEW.email))
      AND created_at > NOW() - INTERVAL '1 hour';

    IF v_count >= 5 THEN
        RAISE EXCEPTION 'support_rate_limit_exceeded' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_message_rate_limit ON public.support_messages;
CREATE TRIGGER trg_support_message_rate_limit
    BEFORE INSERT ON public.support_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_support_message_rate_limit();
