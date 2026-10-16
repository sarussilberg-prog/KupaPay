-- Pro v2: smart payment reminders (#163)

ALTER TABLE public.groups
    ADD COLUMN IF NOT EXISTS smart_reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS smart_reminder_interval_days INT,
    ADD COLUMN IF NOT EXISTS smart_reminder_set_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS smart_reminder_last_run_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.group_smart_reminder_recipient_state (
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    debtor_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, debtor_user_id)
);

ALTER TABLE public.group_smart_reminder_recipient_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group members read smart reminder state"
    ON public.group_smart_reminder_recipient_state FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = group_smart_reminder_recipient_state.group_id
              AND gm.user_id = auth.uid()
              AND gm.is_active = TRUE
        )
    );

-- Pairwise debts without auth.uid() membership gate (cron/internal only).
CREATE OR REPLACE FUNCTION public._get_group_pairwise_debts_core(p_group_id UUID)
RETURNS TABLE (
    from_user_id UUID,
    to_user_id UUID,
    currency VARCHAR,
    amount NUMERIC
)
LANGUAGE plpgsql
STABLE
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
        CASE WHEN pn.lo_to_hi > 0 THEN pn.u_lo ELSE pn.u_hi END AS from_user_id,
        CASE WHEN pn.lo_to_hi > 0 THEN pn.u_hi ELSE pn.u_lo END AS to_user_id,
        pn.currency,
        ROUND(ABS(pn.lo_to_hi)::numeric, 2) AS amount
    FROM pair_net pn
    WHERE ABS(pn.lo_to_hi) >= 0.01;
END;
$$;

REVOKE ALL ON FUNCTION public._get_group_pairwise_debts_core(UUID) FROM PUBLIC;

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

REVOKE ALL ON FUNCTION public.set_group_smart_reminder(UUID, BOOLEAN, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_group_smart_reminder(UUID, BOOLEAN, INT) TO authenticated;

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
            WHERE group_id = v_group.id AND debtor_user_id = v_debt.from_user_id;

            IF v_last IS NOT NULL THEN
                IF NOW() - v_last < v_floor THEN
                    CONTINUE;
                END IF;
                IF v_group.smart_reminder_interval_days IS NOT NULL
                   AND NOW() - v_last < (v_group.smart_reminder_interval_days || ' days')::interval THEN
                    CONTINUE;
                END IF;
            END IF;

            v_message := format(
                'You owe %s %s to a group member. Open Settle Up to pay.',
                v_debt.amount,
                v_debt.currency
            );

            INSERT INTO public.activity_events (
                id, user_id, kind, group_id, ref_id, actor_user_id, metadata
            ) VALUES (
                gen_random_uuid(),
                v_debt.from_user_id,
                'settle_up_reminder',
                v_group.id,
                gen_random_uuid(),
                v_group.smart_reminder_set_by,
                jsonb_build_object('body', v_message, 'smart', true)
            );

            INSERT INTO public.group_smart_reminder_recipient_state (group_id, debtor_user_id, last_sent_at)
            VALUES (v_group.id, v_debt.from_user_id, NOW())
            ON CONFLICT (group_id, debtor_user_id)
            DO UPDATE SET last_sent_at = EXCLUDED.last_sent_at;

            v_sent := v_sent + 1;
        END LOOP;
    END LOOP;

    PERFORM pg_advisory_unlock(8712345678901235);
    RETURN jsonb_build_object('ok', true, 'sent', v_sent);
EXCEPTION WHEN OTHERS THEN
    PERFORM pg_advisory_unlock(8712345678901235);
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.run_smart_payment_reminders(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_smart_payment_reminders(INT) TO service_role;

-- Deduplicate pairwise debt SQL: member RPC delegates to core.
CREATE OR REPLACE FUNCTION public.get_group_pairwise_debts(p_group_id UUID)
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
    IF NOT public.is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'not a member of group';
    END IF;
    RETURN QUERY SELECT * FROM public._get_group_pairwise_debts_core(p_group_id);
END;
$$;
