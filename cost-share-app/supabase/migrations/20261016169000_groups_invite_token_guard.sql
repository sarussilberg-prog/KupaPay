-- #285 — Block direct PATCH of groups.invite_token (rotate_group_invite RPC only).

CREATE OR REPLACE FUNCTION app_private.allow_groups_invite_token_write()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT set_config('app.groups_invite_write', '1', true);
$$;

REVOKE ALL ON FUNCTION app_private.allow_groups_invite_token_write() FROM PUBLIC, anon, authenticated;

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

    IF NEW.invite_token IS DISTINCT FROM OLD.invite_token THEN
        RAISE EXCEPTION 'group_invite_token_rpc_only' USING ERRCODE = '42501';
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

CREATE OR REPLACE FUNCTION public.rotate_group_invite(p_group_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_me UUID := auth.uid();
    v_member BOOLEAN;
    v_new TEXT;
BEGIN
    IF v_me IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = p_group_id AND user_id = v_me AND is_active = TRUE
    ) INTO v_member;

    IF NOT v_member THEN
        RAISE EXCEPTION 'not_group_member';
    END IF;

    v_new := public.generate_invite_token();
    PERFORM app_private.allow_groups_invite_token_write();
    UPDATE public.groups SET invite_token = v_new WHERE id = p_group_id;
    RETURN v_new;
END;
$$;
