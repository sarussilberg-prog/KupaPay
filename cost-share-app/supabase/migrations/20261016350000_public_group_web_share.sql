-- #398 — Public web group balance page (opt-in, token-gated, rate-limited).

ALTER TABLE public.groups
    ADD COLUMN IF NOT EXISTS public_web_share_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.groups.public_web_share_enabled IS
    'When true, /g/<invite_token> may expose privacy-scoped balances via get_public_group_web_view (anon RPC only).';

CREATE OR REPLACE FUNCTION app_private.allow_groups_public_web_share_write()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT set_config('app.groups_public_web_share_write', '1', true);
$$;

REVOKE ALL ON FUNCTION app_private.allow_groups_public_web_share_write() FROM PUBLIC, anon, authenticated;

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
    IF current_setting('app.groups_public_web_share_write', true) = '1' THEN
        RETURN NEW;
    END IF;

    IF NEW.invite_token IS DISTINCT FROM OLD.invite_token THEN
        RAISE EXCEPTION 'group_invite_token_rpc_only' USING ERRCODE = '42501';
    END IF;

    IF NEW.public_web_share_enabled IS DISTINCT FROM OLD.public_web_share_enabled THEN
        RAISE EXCEPTION 'group_public_web_share_rpc_only' USING ERRCODE = '42501';
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

CREATE OR REPLACE FUNCTION public._profile_public_display_name(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        CASE
            WHEN p.is_active THEN NULLIF(btrim(p.name), '')
            ELSE NULL
        END,
        'Deleted user'
    )
    FROM public.profiles p
    WHERE p.id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public._profile_public_display_name(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_group_public_web_share(
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

    PERFORM app_private.allow_groups_public_web_share_write();
    UPDATE public.groups
    SET public_web_share_enabled = COALESCE(p_enabled, FALSE)
    WHERE id = p_group_id AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'group_not_found';
    END IF;

    RETURN COALESCE(p_enabled, FALSE);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_group_public_web_share(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_group_public_web_share(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_group_web_view(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_group RECORD;
    v_members JSON;
    v_balances JSON;
    v_debts JSON;
    v_expenses JSON;
BEGIN
    PERFORM public.enforce_invite_preview_rate_limit();

    IF p_token IS NULL OR length(btrim(p_token)) < 12 THEN
        RETURN json_build_object('kind', 'not_found');
    END IF;

    SELECT g.id, g.name, g.default_currency, g.public_web_share_enabled
    INTO v_group
    FROM public.groups g
    WHERE g.invite_token = btrim(p_token)
      AND g.is_active = TRUE
    LIMIT 1;

    IF NOT FOUND OR NOT COALESCE(v_group.public_web_share_enabled, FALSE) THEN
        RETURN json_build_object('kind', 'not_found');
    END IF;

    WITH members AS (
        SELECT gm.user_id
        FROM public.group_members gm
        WHERE gm.group_id = v_group.id AND gm.is_active = TRUE
    ),
    paid AS (
        SELECT e.paid_by AS user_id, e.currency, SUM(e.amount) AS amount
        FROM public.expenses e
        WHERE e.group_id = v_group.id AND e.is_deleted = FALSE
        GROUP BY e.paid_by, e.currency
    ),
    owed AS (
        SELECT es.user_id, e.currency, SUM(es.amount) AS amount
        FROM public.expense_splits es
        JOIN public.expenses e ON e.id = es.expense_id
        WHERE e.group_id = v_group.id AND e.is_deleted = FALSE
        GROUP BY es.user_id, e.currency
    ),
    settled_in AS (
        SELECT s.to_user_id AS user_id, s.currency, SUM(s.amount) AS amount
        FROM public.settlements s
        WHERE s.group_id = v_group.id AND s.deleted_at IS NULL
        GROUP BY s.to_user_id, s.currency
    ),
    settled_out AS (
        SELECT s.from_user_id AS user_id, s.currency, SUM(s.amount) AS amount
        FROM public.settlements s
        WHERE s.group_id = v_group.id AND s.deleted_at IS NULL
        GROUP BY s.from_user_id, s.currency
    ),
    currency_keys AS (
        SELECT user_id, currency FROM paid
        UNION SELECT user_id, currency FROM owed
        UNION SELECT user_id, currency FROM settled_in
        UNION SELECT user_id, currency FROM settled_out
    ),
    member_balances AS (
        SELECT
            ck.user_id,
            ck.currency,
            ROUND(
                (
                    COALESCE(p.amount, 0) - COALESCE(o.amount, 0)
                    + COALESCE(si.amount, 0) - COALESCE(so.amount, 0)
                )::numeric,
                2
            ) AS net
        FROM currency_keys ck
        JOIN members m ON m.user_id = ck.user_id
        LEFT JOIN paid p ON p.user_id = ck.user_id AND p.currency = ck.currency
        LEFT JOIN owed o ON o.user_id = ck.user_id AND o.currency = ck.currency
        LEFT JOIN settled_in si ON si.user_id = ck.user_id AND si.currency = ck.currency
        LEFT JOIN settled_out so ON so.user_id = ck.user_id AND so.currency = ck.currency
    ),
    balance_rows AS (
        SELECT
            public._profile_public_display_name(mb.user_id) AS display_name,
            mb.currency,
            mb.net
        FROM member_balances mb
        WHERE ABS(mb.net) >= 0.01
        ORDER BY display_name, mb.currency
    )
    SELECT COALESCE(
        json_agg(
            json_build_object(
                'displayName', display_name,
                'currency', currency,
                'net', net
            )
        ),
        '[]'::json
    )
    INTO v_balances
    FROM balance_rows;

    WITH debt_rows AS (
        SELECT
            public._profile_public_display_name(d.from_user_id) AS from_name,
            public._profile_public_display_name(d.to_user_id) AS to_name,
            d.currency,
            ROUND(d.amount::numeric, 2) AS amount
        FROM public._get_group_pairwise_debts_core(v_group.id) d
        ORDER BY d.currency, amount DESC
    )
    SELECT COALESCE(
        json_agg(
            json_build_object(
                'fromName', from_name,
                'toName', to_name,
                'currency', currency,
                'amount', amount
            )
        ),
        '[]'::json
    )
    INTO v_debts
    FROM debt_rows;

    SELECT COALESCE(
        json_agg(
            json_build_object(
                'description', left(e.description, 120),
                'amount', ROUND(e.amount::numeric, 2),
                'currency', e.currency,
                'expenseDate', e.expense_date,
                'paidByName', public._profile_public_display_name(e.paid_by)
            )
            ORDER BY e.expense_date DESC, e.created_at DESC
        ),
        '[]'::json
    )
    INTO v_expenses
    FROM (
        SELECT e.description, e.amount, e.currency, e.expense_date, e.paid_by, e.created_at
        FROM public.expenses e
        WHERE e.group_id = v_group.id AND e.is_deleted = FALSE
        ORDER BY e.expense_date DESC, e.created_at DESC
        LIMIT 8
    ) e;

    SELECT COALESCE(
        json_agg(
            json_build_object('displayName', public._profile_public_display_name(m.user_id))
            ORDER BY public._profile_public_display_name(m.user_id)
        ),
        '[]'::json
    )
    INTO v_members
    FROM (
        SELECT gm.user_id
        FROM public.group_members gm
        WHERE gm.group_id = v_group.id AND gm.is_active = TRUE
    ) m;

    RETURN json_build_object(
        'kind', 'ok',
        'group', json_build_object(
            'name', v_group.name,
            'currency', v_group.default_currency
        ),
        'members', v_members,
        'balances', v_balances,
        'debts', v_debts,
        'recentExpenses', v_expenses
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_group_web_view(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_group_web_view(TEXT) TO anon, authenticated;
