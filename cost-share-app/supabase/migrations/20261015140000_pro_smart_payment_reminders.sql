-- Pro smart payment reminders: per-group digest to debtors (max 1 / 3 days per debtor).

ALTER TABLE public.groups
    ADD COLUMN IF NOT EXISTS smart_reminder_interval_days INT,
    ADD COLUMN IF NOT EXISTS smart_reminder_set_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS smart_reminder_last_run_at TIMESTAMPTZ;

ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_smart_reminder_interval_days_check;
ALTER TABLE public.groups ADD CONSTRAINT groups_smart_reminder_interval_days_check
    CHECK (smart_reminder_interval_days IS NULL OR smart_reminder_interval_days >= 3);

COMMENT ON COLUMN public.groups.smart_reminder_interval_days IS
    'Pro: days between automated payment reminder digests; NULL = off.';
COMMENT ON COLUMN public.groups.smart_reminder_set_by IS
    'Member who enabled smart reminders (must stay Pro or group Trip Pass active).';

CREATE TABLE IF NOT EXISTS public.group_smart_reminder_recipient_state (
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    debtor_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, debtor_user_id)
);

ALTER TABLE public.group_smart_reminder_recipient_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group members read smart reminder state"
    ON public.group_smart_reminder_recipient_state FOR SELECT
    USING (public.is_group_member(group_id));

-- Pairwise debts for cron (no auth.uid() membership check).
CREATE OR REPLACE FUNCTION public.get_group_pairwise_debts_for_service(p_group_id UUID)
RETURNS TABLE (
    from_user_id UUID,
    to_user_id UUID,
    currency VARCHAR,
    amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH expense_debts AS (
        SELECT es.user_id AS debtor, e.paid_by AS creditor, e.currency, SUM(es.amount) AS amount
        FROM expense_splits es
        JOIN expenses e ON e.id = es.expense_id
        WHERE e.group_id = p_group_id
          AND e.is_deleted = FALSE
          AND es.user_id <> e.paid_by
        GROUP BY es.user_id, e.paid_by, e.currency
    ),
    settlement_debts AS (
        SELECT s.from_user_id AS debtor, s.to_user_id AS creditor, s.currency, SUM(s.amount) AS amount
        FROM settlements s
        WHERE s.group_id = p_group_id
          AND s.deleted_at IS NULL
        GROUP BY s.from_user_id, s.to_user_id, s.currency
    ),
    pair_combos AS (
        SELECT debtor, creditor, currency FROM expense_debts
        UNION
        SELECT creditor, debtor, currency FROM expense_debts
        UNION
        SELECT debtor, creditor, currency FROM settlement_debts
        UNION
        SELECT creditor, debtor, currency FROM settlement_debts
    ),
    directed_net AS (
        SELECT
            pc.debtor,
            pc.creditor,
            pc.currency,
            COALESCE((SELECT ed.amount FROM expense_debts ed
                      WHERE ed.debtor = pc.debtor AND ed.creditor = pc.creditor AND ed.currency = pc.currency), 0)
            - COALESCE((SELECT sd.amount FROM settlement_debts sd
                      WHERE sd.debtor = pc.debtor AND sd.creditor = pc.creditor AND sd.currency = pc.currency), 0)
            AS gross
        FROM pair_combos pc
    ),
    pair_net AS (
        SELECT
            LEAST(d1.debtor, d1.creditor) AS u_lo,
            GREATEST(d1.debtor, d1.creditor) AS u_hi,
            d1.currency,
            SUM(CASE WHEN d1.debtor < d1.creditor THEN d1.gross ELSE -d1.gross END) AS lo_to_hi
        FROM directed_net d1
        GROUP BY LEAST(d1.debtor, d1.creditor), GREATEST(d1.debtor, d1.creditor), d1.currency
    )
    SELECT
        CASE WHEN pn.lo_to_hi > 0 THEN pn.u_lo ELSE pn.u_hi END,
        CASE WHEN pn.lo_to_hi > 0 THEN pn.u_hi ELSE pn.u_lo END,
        pn.currency,
        ROUND(ABS(pn.lo_to_hi)::numeric, 2)
    FROM pair_net pn
    WHERE ABS(pn.lo_to_hi) >= 0.01;
END;
$$;

REVOKE ALL ON FUNCTION public.get_group_pairwise_debts_for_service(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_group_pairwise_debts_for_service(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.set_group_smart_reminder(
    p_group_id UUID,
    p_interval_days INT
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
    IF p_interval_days IS NOT NULL AND p_interval_days > 0 AND p_interval_days < 3 THEN
        RAISE EXCEPTION 'interval_too_short';
    END IF;
    IF p_interval_days IS NULL OR p_interval_days <= 0 THEN
        UPDATE public.groups
        SET smart_reminder_interval_days = NULL,
            smart_reminder_set_by = NULL,
            smart_reminder_last_run_at = NULL
        WHERE id = p_group_id;
        RETURN;
    END IF;
    UPDATE public.groups
    SET smart_reminder_interval_days = p_interval_days,
        smart_reminder_set_by = auth.uid(),
        smart_reminder_last_run_at = NULL
    WHERE id = p_group_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_group_smart_reminder(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_group_smart_reminder(UUID, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.run_smart_payment_reminders(p_now TIMESTAMPTZ DEFAULT NOW())
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_group RECORD;
    v_debtor RECORD;
    v_row RECORD;
    v_sent INT := 0;
    v_skipped INT := 0;
    v_actor UUID;
    v_body TEXT;
    v_lines TEXT[];
    v_last TIMESTAMPTZ;
    v_min_debtor_gap INTERVAL := INTERVAL '3 days';
BEGIN
    FOR v_group IN
        SELECT g.id, g.name, g.smart_reminder_interval_days, g.smart_reminder_set_by, g.smart_reminder_last_run_at
        FROM public.groups g
        WHERE g.is_active = TRUE
          AND g.smart_reminder_interval_days IS NOT NULL
          AND g.smart_reminder_interval_days >= 3
          AND g.smart_reminder_set_by IS NOT NULL
          AND (
              EXISTS (
                  SELECT 1 FROM public.group_passes gp
                  WHERE gp.group_id = g.id AND gp.until > p_now
              )
              OR public.has_pro(g.smart_reminder_set_by, g.id)
          )
          AND (
              g.smart_reminder_last_run_at IS NULL
              OR g.smart_reminder_last_run_at + (g.smart_reminder_interval_days || ' days')::INTERVAL <= p_now
          )
    LOOP
        v_actor := v_group.smart_reminder_set_by;
        FOR v_debtor IN
            SELECT DISTINCT d.from_user_id AS debtor_id
            FROM public.get_group_pairwise_debts_for_service(v_group.id) d
        LOOP
            SELECT s.last_sent_at INTO v_last
            FROM public.group_smart_reminder_recipient_state s
            WHERE s.group_id = v_group.id AND s.debtor_user_id = v_debtor.debtor_id;

            IF v_last IS NOT NULL AND v_last + v_min_debtor_gap > p_now THEN
                v_skipped := v_skipped + 1;
                CONTINUE;
            END IF;

            v_lines := ARRAY[]::TEXT[];
            FOR v_row IN
                SELECT d.currency, d.amount
                FROM public.get_group_pairwise_debts_for_service(v_group.id) d
                WHERE d.from_user_id = v_debtor.debtor_id
            LOOP
                v_lines := array_append(v_lines, v_row.currency || ' ' || ROUND(v_row.amount, 2)::TEXT);
            END LOOP;

            IF array_length(v_lines, 1) IS NULL THEN
                CONTINUE;
            END IF;

            v_body := 'You still owe in ' || v_group.name || ': ' || array_to_string(v_lines, ', ');

            INSERT INTO public.activity_events (
                id, user_id, kind, group_id, ref_id, actor_user_id, metadata
            ) VALUES (
                gen_random_uuid(),
                v_debtor.debtor_id,
                'settle_up_reminder',
                v_group.id,
                gen_random_uuid(),
                v_actor,
                jsonb_build_object('body', v_body, 'smart_reminder', true)
            );

            INSERT INTO public.group_smart_reminder_recipient_state (group_id, debtor_user_id, last_sent_at)
            VALUES (v_group.id, v_debtor.debtor_id, p_now)
            ON CONFLICT (group_id, debtor_user_id)
            DO UPDATE SET last_sent_at = EXCLUDED.last_sent_at;

            v_sent := v_sent + 1;
        END LOOP;

        UPDATE public.groups SET smart_reminder_last_run_at = p_now WHERE id = v_group.id;
    END LOOP;

    RETURN jsonb_build_object('sent', v_sent, 'skipped', v_skipped);
END;
$$;

REVOKE ALL ON FUNCTION public.run_smart_payment_reminders(TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_smart_payment_reminders(TIMESTAMPTZ) TO service_role;
