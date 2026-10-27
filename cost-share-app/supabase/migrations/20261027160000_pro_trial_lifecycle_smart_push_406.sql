-- #406 — Route Pro trial lifecycle pushes through activity_events → send-push (#402).

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
        'trip_budget_alert',
        'unsettled_balance_nudge',
        'pro_trial_lifecycle_nudge'
    ));

CREATE OR REPLACE FUNCTION public.run_pro_trial_lifecycle_dispatch(p_limit INT DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row record;
    v_start timestamptz;
    v_day int;
    v_sent jsonb;
    v_inserted int := 0;
BEGIN
    FOR v_row IN
        SELECT p.id, p.pro_trial_ends_at, p.pro_trial_lifecycle_sent, p.pro_trial_feature_usage
        FROM profiles p
        WHERE p.is_active = TRUE
          AND p.pro_trial_ends_at IS NOT NULL
          AND p.pro_trial_ends_at > NOW()
        LIMIT GREATEST(p_limit, 1) * 20
    LOOP
        v_start := v_row.pro_trial_ends_at - INTERVAL '14 days';
        v_day := GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (NOW() - v_start)) / 86400)::int + 1);
        v_sent := COALESCE(v_row.pro_trial_lifecycle_sent, '[]'::jsonb);

        IF v_day IN (1, 10, 13)
           AND NOT v_sent @> to_jsonb(v_day::text) THEN
            INSERT INTO public.activity_events (
                user_id, kind, group_id, ref_id, actor_user_id, metadata
            ) VALUES (
                v_row.id,
                'pro_trial_lifecycle_nudge',
                NULL,
                gen_random_uuid(),
                v_row.id,
                jsonb_build_object(
                    'touch_day', v_day,
                    'feature_usage', COALESCE(v_row.pro_trial_feature_usage, '{}'::jsonb),
                    'retention', true
                )
            );
            PERFORM public.mark_pro_trial_lifecycle_sent_service(v_row.id, v_day);
            v_inserted := v_inserted + 1;
            EXIT WHEN v_inserted >= GREATEST(p_limit, 1);
        END IF;
    END LOOP;

    RETURN jsonb_build_object('ok', true, 'inserted', v_inserted);
END;
$$;

REVOKE ALL ON FUNCTION public.run_pro_trial_lifecycle_dispatch(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_pro_trial_lifecycle_dispatch(INT) TO service_role;
