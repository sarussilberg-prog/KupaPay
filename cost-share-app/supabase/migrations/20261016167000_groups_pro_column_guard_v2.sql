-- #264 follow-up — Block client JWT sessions from PATCHing Pro columns (use auth.uid + bypass flag).

CREATE OR REPLACE FUNCTION app_private.allow_groups_pro_column_write()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT set_config('app.groups_pro_write', '1', true);
$$;

REVOKE ALL ON FUNCTION app_private.allow_groups_pro_column_write() FROM PUBLIC, anon, authenticated;

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

-- Pro RPCs: set bypass before UPDATE
CREATE OR REPLACE FUNCTION public.set_group_trip_budget(
    p_group_id UUID,
    p_amount NUMERIC,
    p_currency VARCHAR(3)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_currency VARCHAR(3);
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;
    IF NOT public.is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'not_group_member';
    END IF;
    IF NOT public.has_pro(v_uid, p_group_id) THEN
        RAISE EXCEPTION 'pro_required';
    END IF;

    PERFORM app_private.allow_groups_pro_column_write();

    IF p_amount IS NULL OR p_amount <= 0 THEN
        UPDATE public.groups
        SET
            trip_budget_amount = NULL,
            trip_budget_currency = NULL,
            trip_budget_set_by = NULL,
            trip_budget_alert_80_sent = FALSE,
            trip_budget_alert_100_sent = FALSE
        WHERE id = p_group_id;
        RETURN;
    END IF;

    v_currency := upper(trim(p_currency));
    IF v_currency IS NULL OR length(v_currency) <> 3 THEN
        RAISE EXCEPTION 'invalid_currency';
    END IF;

    UPDATE public.groups
    SET
        trip_budget_amount = round(p_amount::numeric, 2),
        trip_budget_currency = v_currency,
        trip_budget_set_by = v_uid,
        trip_budget_alert_80_sent = FALSE,
        trip_budget_alert_100_sent = FALSE
    WHERE id = p_group_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_group_smart_reminder(
    p_group_id UUID,
    p_enabled BOOLEAN,
    p_interval_days INT DEFAULT NULL
)
RETURNS public.groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_row public.groups;
    v_interval int;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;
    IF NOT public.is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'not a member of group';
    END IF;
    IF NOT public.has_pro(v_uid, p_group_id) THEN
        RAISE EXCEPTION 'pro required';
    END IF;

    v_interval := COALESCE(p_interval_days, 7);
    IF p_enabled AND v_interval < 3 THEN
        RAISE EXCEPTION 'interval too short';
    END IF;

    PERFORM app_private.allow_groups_pro_column_write();

    UPDATE public.groups
    SET
        smart_reminder_enabled = p_enabled,
        smart_reminder_interval_days = CASE WHEN p_enabled THEN v_interval ELSE smart_reminder_interval_days END,
        smart_reminder_set_by = CASE WHEN p_enabled THEN v_uid ELSE NULL END,
        updated_at = NOW()
    WHERE id = p_group_id
    RETURNING * INTO v_row;

    IF NOT p_enabled THEN
        DELETE FROM public.group_smart_reminder_recipient_state WHERE group_id = p_group_id;
    END IF;

    RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.evaluate_trip_budget_alerts(p_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_group public.groups%ROWTYPE;
    v_spent NUMERIC;
    v_pct NUMERIC;
BEGIN
    SELECT * INTO v_group FROM public.groups WHERE id = p_group_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN;
    END IF;
    IF v_group.trip_budget_amount IS NULL OR v_group.trip_budget_amount <= 0 THEN
        RETURN;
    END IF;
    IF v_group.trip_budget_set_by IS NULL OR v_group.trip_budget_currency IS NULL THEN
        RETURN;
    END IF;
    IF NOT public.has_pro(v_group.trip_budget_set_by, p_group_id) THEN
        RETURN;
    END IF;

    SELECT COALESCE(SUM(e.amount), 0) INTO v_spent
    FROM public.expenses e
    WHERE e.group_id = p_group_id
      AND e.is_deleted = FALSE
      AND e.currency = v_group.trip_budget_currency;

    v_pct := (v_spent / v_group.trip_budget_amount) * 100;

    PERFORM app_private.allow_groups_pro_column_write();

    IF v_pct >= 100 AND NOT v_group.trip_budget_alert_100_sent THEN
        PERFORM public._insert_trip_budget_alert_events(
            p_group_id,
            v_group.trip_budget_set_by,
            100,
            v_spent,
            v_group.trip_budget_amount,
            v_group.trip_budget_currency
        );
        UPDATE public.groups
        SET trip_budget_alert_100_sent = TRUE,
            trip_budget_alert_80_sent = TRUE
        WHERE id = p_group_id;
    ELSIF v_pct >= 80 AND NOT v_group.trip_budget_alert_80_sent THEN
        PERFORM public._insert_trip_budget_alert_events(
            p_group_id,
            v_group.trip_budget_set_by,
            80,
            v_spent,
            v_group.trip_budget_amount,
            v_group.trip_budget_currency
        );
        UPDATE public.groups
        SET trip_budget_alert_80_sent = TRUE
        WHERE id = p_group_id;
    END IF;
END;
$$;

-- Patch run_smart_payment_reminders: allow last_run_at updates in cron loop
CREATE OR REPLACE FUNCTION public.run_smart_payment_reminders(p_limit INT DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lock boolean;
    v_sent int := 0;
    v_group public.groups;
    v_debt record;
    v_floor interval := interval '3 days';
    v_last timestamptz;
    v_message text;
BEGIN
    v_lock := pg_try_advisory_lock(8712345678901235);
    IF NOT v_lock THEN
        RETURN jsonb_build_object('ok', true, 'skipped', true);
    END IF;

    PERFORM app_private.allow_groups_pro_column_write();

    FOR v_group IN
        SELECT *
        FROM public.groups g
        WHERE g.smart_reminder_enabled = TRUE
          AND g.smart_reminder_set_by IS NOT NULL
          AND public.has_pro(g.smart_reminder_set_by, g.id)
        ORDER BY g.smart_reminder_last_run_at NULLS FIRST
        LIMIT GREATEST(p_limit, 1)
        FOR UPDATE SKIP LOCKED
    LOOP
        UPDATE public.groups SET smart_reminder_last_run_at = NOW() WHERE id = v_group.id;

        FOR v_debt IN
            SELECT * FROM public._get_group_pairwise_debts_core(v_group.id)
        LOOP
            SELECT last_sent_at INTO v_last
            FROM public.group_smart_reminder_recipient_state
            WHERE group_id = v_group.id AND debtor_user_id = v_debt.debtor_user_id;

            IF v_last IS NOT NULL THEN
                IF v_group.smart_reminder_interval_days IS NOT NULL
                   AND NOW() - v_last < (v_group.smart_reminder_interval_days || ' days')::interval THEN
                    CONTINUE;
                END IF;
                IF NOW() - v_last < v_floor THEN
                    CONTINUE;
                END IF;
            END IF;

            v_message := format(
                'You owe %s %s in %s',
                round(v_debt.amount::numeric, 2),
                v_debt.currency,
                v_group.name
            );

            PERFORM public.send_settle_reminder(
                v_group.id,
                v_debt.debtor_user_id,
                v_message
            );

            INSERT INTO public.group_smart_reminder_recipient_state (group_id, debtor_user_id, last_sent_at)
            VALUES (v_group.id, v_debt.debtor_user_id, NOW())
            ON CONFLICT (group_id, debtor_user_id)
            DO UPDATE SET last_sent_at = EXCLUDED.last_sent_at;

            v_sent := v_sent + 1;
        END LOOP;
    END LOOP;

    PERFORM pg_advisory_unlock(8712345678901235);
    RETURN jsonb_build_object('ok', true, 'sent', v_sent);
END;
$$;
