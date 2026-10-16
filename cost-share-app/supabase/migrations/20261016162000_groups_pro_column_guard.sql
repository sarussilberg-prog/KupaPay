-- #264 — Block direct PostgREST PATCH on Pro-only groups columns; RPCs/cron run as owner.

CREATE OR REPLACE FUNCTION public.guard_groups_pro_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF current_user <> 'authenticated' THEN
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

DROP TRIGGER IF EXISTS trg_guard_groups_pro_columns ON public.groups;
CREATE TRIGGER trg_guard_groups_pro_columns
    BEFORE UPDATE ON public.groups
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_groups_pro_columns();
