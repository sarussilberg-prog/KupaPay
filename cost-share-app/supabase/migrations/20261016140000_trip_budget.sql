-- Pro v2: trip budget + alerts (#165)

ALTER TABLE public.groups
    ADD COLUMN IF NOT EXISTS trip_budget_amount NUMERIC,
    ADD COLUMN IF NOT EXISTS trip_budget_currency VARCHAR(3),
    ADD COLUMN IF NOT EXISTS trip_budget_set_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS trip_budget_alert_80_sent BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS trip_budget_alert_100_sent BOOLEAN NOT NULL DEFAULT FALSE;

-- safe-breaking: extend activity_events.kind CHECK
ALTER TABLE public.activity_events
    DROP CONSTRAINT IF EXISTS activity_events_kind_check;

ALTER TABLE public.activity_events
    ADD CONSTRAINT activity_events_kind_check CHECK (kind IN (
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

REVOKE ALL ON FUNCTION public.set_group_trip_budget(UUID, NUMERIC, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_group_trip_budget(UUID, NUMERIC, VARCHAR) TO authenticated;

CREATE OR REPLACE FUNCTION public._insert_trip_budget_alert_events(
    p_group_id UUID,
    p_actor UUID,
    p_threshold INT,
    p_spent NUMERIC,
    p_budget NUMERIC,
    p_currency VARCHAR
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_body TEXT;
BEGIN
    v_body := format(
        'Trip spending reached %s%% of the %s %s budget (%s %s spent).',
        p_threshold,
        p_budget,
        p_currency,
        round(p_spent::numeric, 2),
        p_currency
    );

    INSERT INTO public.activity_events (
        id, user_id, kind, group_id, ref_id, actor_user_id, metadata
    )
    SELECT
        gen_random_uuid(),
        gm.user_id,
        'trip_budget_alert',
        p_group_id,
        gen_random_uuid(),
        p_actor,
        jsonb_build_object(
            'threshold', p_threshold,
            'spent', round(p_spent::numeric, 2),
            'budget', p_budget,
            'currency', p_currency,
            'body', v_body
        )
    FROM public.group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.is_active = TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public._insert_trip_budget_alert_events(UUID, UUID, INT, NUMERIC, NUMERIC, VARCHAR) FROM PUBLIC, anon, authenticated;

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

REVOKE ALL ON FUNCTION public.evaluate_trip_budget_alerts(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_evaluate_trip_budget_on_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.evaluate_trip_budget_alerts(OLD.group_id);
        RETURN OLD;
    END IF;

    IF TG_OP = 'INSERT' THEN
        PERFORM public.evaluate_trip_budget_alerts(NEW.group_id);
        RETURN NEW;
    END IF;

    IF NEW.group_id IS DISTINCT FROM OLD.group_id
       OR NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.is_deleted IS DISTINCT FROM OLD.is_deleted THEN
        PERFORM public.evaluate_trip_budget_alerts(NEW.group_id);
        IF NEW.group_id IS DISTINCT FROM OLD.group_id THEN
            PERFORM public.evaluate_trip_budget_alerts(OLD.group_id);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_evaluate_trip_budget_on_expense() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_trip_budget_on_expense ON public.expenses;
CREATE TRIGGER trg_trip_budget_on_expense
    AFTER INSERT OR UPDATE OF group_id, amount, currency, is_deleted OR DELETE ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION public.trg_evaluate_trip_budget_on_expense();
