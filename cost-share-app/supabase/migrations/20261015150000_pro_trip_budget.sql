-- Pro trip budget + 80% / 100% alerts (push via activity_events).

ALTER TABLE public.groups
    ADD COLUMN IF NOT EXISTS trip_budget_amount NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS trip_budget_currency VARCHAR(3),
    ADD COLUMN IF NOT EXISTS trip_budget_set_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS trip_budget_alert_80_sent BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS trip_budget_alert_100_sent BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_trip_budget_amount_check;
ALTER TABLE public.groups ADD CONSTRAINT groups_trip_budget_amount_check
    CHECK (trip_budget_amount IS NULL OR trip_budget_amount > 0);

ALTER TABLE public.activity_events DROP CONSTRAINT IF EXISTS activity_events_kind_check; -- safe-breaking: extend enum
ALTER TABLE public.activity_events ADD CONSTRAINT activity_events_kind_check CHECK (kind IN (
    'expense_added',
    'settlement_added',
    'message_posted',
    'friend_request_received',
    'group_added',
    'group_member_joined',
    'group_removed',
    'group_created',
    'group_deleted',
    'group_note_changed',
    'settle_up_reminder',
    'consolidation_batch_added',
    'trip_budget_alert'
));

CREATE OR REPLACE FUNCTION public.set_group_trip_budget(
    p_group_id UUID,
    p_amount NUMERIC,
    p_currency VARCHAR
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'not_group_member';
    END IF;
    IF NOT public.has_pro(auth.uid(), p_group_id) THEN
        RAISE EXCEPTION 'pro_required';
    END IF;
    IF p_amount IS NULL OR p_amount <= 0 OR p_currency IS NULL OR length(trim(p_currency)) <> 3 THEN
        UPDATE public.groups
        SET trip_budget_amount = NULL,
            trip_budget_currency = NULL,
            trip_budget_set_by = NULL,
            trip_budget_alert_80_sent = FALSE,
            trip_budget_alert_100_sent = FALSE
        WHERE id = p_group_id;
        RETURN;
    END IF;
    UPDATE public.groups
    SET trip_budget_amount = ROUND(p_amount, 2),
        trip_budget_currency = upper(trim(p_currency)),
        trip_budget_set_by = auth.uid(),
        trip_budget_alert_80_sent = FALSE,
        trip_budget_alert_100_sent = FALSE
    WHERE id = p_group_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_group_trip_budget(UUID, NUMERIC, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_group_trip_budget(UUID, NUMERIC, VARCHAR) TO authenticated;

CREATE OR REPLACE FUNCTION public.evaluate_trip_budget_alerts(p_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_g RECORD;
    v_spent NUMERIC;
    v_pct NUMERIC;
    v_member UUID;
    v_body TEXT;
    v_level TEXT;
BEGIN
    SELECT id, name, trip_budget_amount, trip_budget_currency,
           trip_budget_alert_80_sent, trip_budget_alert_100_sent, trip_budget_set_by
    INTO v_g
    FROM public.groups
    WHERE id = p_group_id
      AND trip_budget_amount IS NOT NULL
      AND trip_budget_currency IS NOT NULL;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.group_passes gp WHERE gp.group_id = p_group_id AND gp.until > NOW()
    ) AND NOT public.has_pro(v_g.trip_budget_set_by, p_group_id) THEN
        RETURN;
    END IF;

    SELECT COALESCE(SUM(e.amount), 0) INTO v_spent
    FROM public.expenses e
    WHERE e.group_id = p_group_id
      AND e.is_deleted = FALSE
      AND e.currency = v_g.trip_budget_currency;

    v_pct := (v_spent / v_g.trip_budget_amount) * 100;

    IF v_pct >= 100 AND NOT v_g.trip_budget_alert_100_sent THEN
        v_level := '100';
        v_body := 'Trip budget reached: ' || ROUND(v_spent, 2) || ' / ' || v_g.trip_budget_amount || ' ' || v_g.trip_budget_currency;
        UPDATE public.groups SET trip_budget_alert_100_sent = TRUE, trip_budget_alert_80_sent = TRUE WHERE id = p_group_id;
    ELSIF v_pct >= 80 AND NOT v_g.trip_budget_alert_80_sent THEN
        v_level := '80';
        v_body := 'Trip budget 80%: ' || ROUND(v_spent, 2) || ' / ' || v_g.trip_budget_amount || ' ' || v_g.trip_budget_currency;
        UPDATE public.groups SET trip_budget_alert_80_sent = TRUE WHERE id = p_group_id;
    ELSE
        RETURN;
    END IF;

    FOR v_member IN
        SELECT gm.user_id FROM public.group_members gm
        WHERE gm.group_id = p_group_id AND gm.is_active = TRUE
    LOOP
        INSERT INTO public.activity_events (
            id, user_id, kind, group_id, ref_id, actor_user_id, metadata
        ) VALUES (
            gen_random_uuid(),
            v_member,
            'trip_budget_alert',
            p_group_id,
            gen_random_uuid(),
            v_g.trip_budget_set_by,
            jsonb_build_object('body', v_body, 'level', v_level, 'spent', v_spent, 'budget', v_g.trip_budget_amount, 'currency', v_g.trip_budget_currency)
        );
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_trip_budget_alerts(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evaluate_trip_budget_alerts(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.evaluate_trip_budget_alerts(UUID) TO postgres;

CREATE OR REPLACE FUNCTION public.trg_expenses_trip_budget_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.is_deleted = FALSE THEN
        PERFORM public.evaluate_trip_budget_alerts(NEW.group_id);
    ELSIF TG_OP = 'UPDATE' AND NEW.is_deleted = FALSE THEN
        PERFORM public.evaluate_trip_budget_alerts(NEW.group_id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS expenses_trip_budget_alert ON public.expenses;
CREATE TRIGGER expenses_trip_budget_alert
    AFTER INSERT OR UPDATE OF amount, currency, is_deleted ON public.expenses
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_expenses_trip_budget_alert();
