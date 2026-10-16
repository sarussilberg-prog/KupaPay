-- Regression: smart reminder cron (from_user_id + direct activity insert; no auth.uid() in send_settle_reminder).

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
            WHERE group_id = v_group.id AND debtor_user_id = v_debt.from_user_id;

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
