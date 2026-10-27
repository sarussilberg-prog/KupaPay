-- #398 follow-up — opt-in gate for public /b/<public_balance_token> balance pages.

ALTER TABLE public.groups
    ADD COLUMN IF NOT EXISTS public_balance_sharing_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.groups.public_balance_sharing_enabled IS
    'When true, get_public_group_balance_page may return data for public_balance_token.';

CREATE OR REPLACE FUNCTION app_private.allow_groups_public_balance_sharing_write()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT set_config('app.groups_public_balance_sharing_write', '1', true);
$$;

REVOKE ALL ON FUNCTION app_private.allow_groups_public_balance_sharing_write()
    FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_groups_pro_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;
    IF current_setting('app.groups_pro_write', true) = '1' THEN
        RETURN NEW;
    END IF;
    IF current_setting('app.groups_invite_write', true) = '1' THEN
        RETURN NEW;
    END IF;
    IF current_setting('app.groups_public_balance_write', true) = '1' THEN
        RETURN NEW;
    END IF;
    IF current_setting('app.groups_public_balance_sharing_write', true) = '1' THEN
        RETURN NEW;
    END IF;

    IF NEW.invite_token IS DISTINCT FROM OLD.invite_token THEN
        RAISE EXCEPTION 'group_invite_token_rpc_only' USING ERRCODE = '42501';
    END IF;

    IF NEW.public_balance_token IS DISTINCT FROM OLD.public_balance_token THEN
        RAISE EXCEPTION 'group_public_balance_token_rpc_only' USING ERRCODE = '42501';
    END IF;

    IF NEW.public_balance_sharing_enabled IS DISTINCT FROM OLD.public_balance_sharing_enabled THEN
        RAISE EXCEPTION 'group_public_balance_sharing_rpc_only' USING ERRCODE = '42501';
    END IF;

    IF NEW.trip_budget_amount IS DISTINCT FROM OLD.trip_budget_amount
        OR NEW.trip_budget_currency IS DISTINCT FROM OLD.trip_budget_currency
        OR NEW.trip_budget_set_by IS DISTINCT FROM OLD.trip_budget_set_by
        OR NEW.trip_budget_alert_80_sent IS DISTINCT FROM OLD.trip_budget_alert_80_sent
        OR NEW.trip_budget_alert_100_sent IS DISTINCT FROM OLD.trip_budget_alert_100_sent
        OR NEW.smart_reminder_enabled IS DISTINCT FROM OLD.smart_reminder_enabled
        OR NEW.smart_reminder_interval_days IS DISTINCT FROM OLD.smart_reminder_interval_days
        OR NEW.smart_reminder_set_by IS DISTINCT FROM OLD.smart_reminder_set_by
        OR NEW.smart_reminder_last_run_at IS DISTINCT FROM OLD.smart_reminder_last_run_at
    THEN
        RAISE EXCEPTION 'pro_group_fields_rpc_only' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_group_public_balance_sharing(
    p_group_id UUID,
    p_enabled BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_me UUID := auth.uid();
BEGIN
    IF v_me IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;
    IF NOT public.is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'not_group_member';
    END IF;

    PERFORM app_private.allow_groups_public_balance_sharing_write();
    UPDATE public.groups
    SET public_balance_sharing_enabled = COALESCE(p_enabled, FALSE)
    WHERE id = p_group_id AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'group_not_found';
    END IF;

    RETURN COALESCE(p_enabled, FALSE);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_group_public_balance_sharing(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_group_public_balance_sharing(UUID, BOOLEAN) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_public_group_balance_page(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_group_id UUID;
    v_group_name TEXT;
    v_default_currency TEXT;
    v_members JSON;
    v_balances JSON;
    v_expenses JSON;
BEGIN
    PERFORM public.enforce_invite_preview_rate_limit();

    IF p_token IS NULL OR length(btrim(p_token)) < 12 THEN
        RETURN json_build_object('ok', false);
    END IF;

    SELECT g.id, g.name, g.default_currency
    INTO v_group_id, v_group_name, v_default_currency
    FROM public.groups AS g
    WHERE g.public_balance_token = btrim(p_token)
      AND g.is_active = TRUE
      AND g.public_balance_sharing_enabled = TRUE
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN json_build_object('ok', false);
    END IF;

    WITH active_roster AS (
        SELECT gm.user_id
        FROM public.group_members AS gm
        WHERE gm.group_id = v_group_id
          AND gm.is_active = TRUE
    ),
    paid AS (
        SELECT e.paid_by AS user_id, e.currency, SUM(e.amount) AS amount
        FROM public.expenses AS e
        WHERE e.group_id = v_group_id
          AND e.is_deleted = FALSE
        GROUP BY e.paid_by, e.currency
    ),
    owed AS (
        SELECT es.user_id, e.currency, SUM(es.amount) AS amount
        FROM public.expense_splits AS es
        JOIN public.expenses AS e ON e.id = es.expense_id
        WHERE e.group_id = v_group_id
          AND e.is_deleted = FALSE
        GROUP BY es.user_id, e.currency
    ),
    expense_remainder AS (
        SELECT e.paid_by AS user_id, e.currency,
               SUM(e.amount - COALESCE(s.split_sum, 0)) AS amount
        FROM public.expenses AS e
        LEFT JOIN (
            SELECT es.expense_id, SUM(es.amount) AS split_sum
            FROM public.expense_splits AS es
            GROUP BY es.expense_id
        ) AS s ON s.expense_id = e.id
        WHERE e.group_id = v_group_id
          AND e.is_deleted = FALSE
        GROUP BY e.paid_by, e.currency
    ),
    settled_paid AS (
        SELECT s.from_user_id AS user_id, s.currency, SUM(s.amount) AS amount
        FROM public.settlements AS s
        WHERE s.group_id = v_group_id
          AND s.deleted_at IS NULL
        GROUP BY s.from_user_id, s.currency
    ),
    settled_received AS (
        SELECT s.to_user_id AS user_id, s.currency, SUM(s.amount) AS amount
        FROM public.settlements AS s
        WHERE s.group_id = v_group_id
          AND s.deleted_at IS NULL
        GROUP BY s.to_user_id, s.currency
    ),
    footprint_users AS (
        SELECT user_id FROM paid
        UNION SELECT user_id FROM owed
        UNION SELECT user_id FROM settled_paid
        UNION SELECT user_id FROM settled_received
    ),
    relevant_users AS (
        SELECT user_id FROM active_roster
        UNION
        SELECT user_id FROM footprint_users
    ),
    member_keys AS (
        SELECT
            ru.user_id,
            ('m' || (ROW_NUMBER() OVER (ORDER BY ru.user_id) - 1)::TEXT) AS member_key
        FROM relevant_users AS ru
    ),
    roster AS (
        SELECT
            mk.member_key,
            CASE
                WHEN ar.user_id IS NULL THEN NULL
                WHEN p.is_active = FALSE THEN NULL
                ELSE NULLIF(btrim(p.name), '')
            END AS display_name,
            (
                ar.user_id IS NULL
                OR p.is_active = FALSE
            ) AS redacted
        FROM member_keys AS mk
        JOIN public.profiles AS p ON p.id = mk.user_id
        LEFT JOIN active_roster AS ar ON ar.user_id = mk.user_id
    ),
    activity AS (
        SELECT currency FROM paid
        UNION SELECT currency FROM owed
        UNION SELECT currency FROM settled_paid
        UNION SELECT currency FROM settled_received
    ),
    per_currency_user AS (
        SELECT
            a.currency,
            ru.user_id,
            ROUND((
                COALESCE(p.amount, 0)
              - COALESCE(o.amount, 0)
              - COALESCE(rem.amount, 0)
              + COALESCE(sp.amount, 0)
              - COALESCE(sr.amount, 0)
            )::NUMERIC, 2) AS net
        FROM activity AS a
        CROSS JOIN relevant_users AS ru
        LEFT JOIN paid AS p
            ON p.currency = a.currency AND p.user_id = ru.user_id
        LEFT JOIN owed AS o
            ON o.currency = a.currency AND o.user_id = ru.user_id
        LEFT JOIN expense_remainder AS rem
            ON rem.currency = a.currency AND rem.user_id = ru.user_id
        LEFT JOIN settled_paid AS sp
            ON sp.currency = a.currency AND sp.user_id = ru.user_id
        LEFT JOIN settled_received AS sr
            ON sr.currency = a.currency AND sr.user_id = ru.user_id
    ),
    nonzero AS (
        SELECT currency
        FROM per_currency_user
        GROUP BY currency
        HAVING MAX(ABS(net)) >= 0.01
    ),
    balances_json AS (
        SELECT COALESCE(
            json_agg(
                json_build_object(
                    'currency', pc.currency,
                    'nets', nets.rows
                )
                ORDER BY pc.currency
            ),
            '[]'::JSON
        ) AS payload
        FROM nonzero AS pc
        CROSS JOIN LATERAL (
            SELECT COALESCE(
                json_agg(
                    json_build_object(
                        'member_key', mk.member_key,
                        'net', pcu.net
                    )
                    ORDER BY pcu.user_id
                ),
                '[]'::JSON
            ) AS rows
            FROM per_currency_user AS pcu
            JOIN member_keys AS mk ON mk.user_id = pcu.user_id
            WHERE pcu.currency = pc.currency
              AND ABS(pcu.net) >= 0.01
        ) AS nets
    ),
    members_json AS (
        SELECT COALESCE(
            json_agg(
                json_build_object(
                    'member_key', member_key,
                    'display_name', display_name,
                    'redacted', redacted
                )
                ORDER BY member_key
            ),
            '[]'::JSON
        ) AS payload
        FROM roster
    )
    SELECT members_json.payload, balances_json.payload
    INTO v_members, v_balances
    FROM members_json
    CROSS JOIN balances_json;

    SELECT COALESCE(
        json_agg(
            json_build_object(
                'description', NULLIF(btrim(e.description), ''),
                'amount', e.amount,
                'currency', e.currency,
                'expense_date', e.expense_date,
                'paid_by_name', CASE
                    WHEN payer.is_active = FALSE THEN NULL
                    ELSE NULLIF(btrim(payer.name), '')
                END,
                'paid_by_redacted', (payer.is_active = FALSE)
            )
            ORDER BY e.created_at DESC
        ),
        '[]'::JSON
    )
    INTO v_expenses
    FROM (
        SELECT e.description, e.amount, e.currency, e.expense_date, e.paid_by, e.created_at
        FROM public.expenses AS e
        WHERE e.group_id = v_group_id
          AND e.is_deleted = FALSE
        ORDER BY e.created_at DESC
        LIMIT 10
    ) AS e
    JOIN public.profiles AS payer ON payer.id = e.paid_by;

    RETURN json_build_object(
        'ok', true,
        'group', json_build_object(
            'name', v_group_name,
            'default_currency', v_default_currency
        ),
        'members', v_members,
        'balances_by_currency', v_balances,
        'recent_expenses', v_expenses
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_group_balance_page(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_group_balance_page(TEXT) TO anon, authenticated;
