-- #405 Weekly summary (push + email).

ALTER TABLE public.notification_preferences
    ADD COLUMN IF NOT EXISTS weekly_digest_push BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS weekly_digest_email BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS public.weekly_digest_deliveries (
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    week_start  DATE NOT NULL,
    sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, week_start)
);

ALTER TABLE public.weekly_digest_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own weekly digest deliveries"
    ON public.weekly_digest_deliveries FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public._weekly_digest_stats(p_user_id UUID)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH debts AS (
        SELECT d.amount, d.currency, d.from_user_id, d.to_user_id, gm.group_id
        FROM group_members gm
        JOIN LATERAL public._get_group_pairwise_debts_core(gm.group_id) d ON TRUE
        WHERE gm.user_id = p_user_id AND gm.is_active = TRUE
    ),
    owe AS (
        SELECT COALESCE(SUM(amount), 0) AS total FROM debts WHERE from_user_id = p_user_id
    ),
    owed AS (
        SELECT COALESCE(SUM(amount), 0) AS total FROM debts WHERE to_user_id = p_user_id
    ),
    top_group AS (
        SELECT g.name
        FROM expenses e
        JOIN groups g ON g.id = e.group_id
        JOIN group_members gm ON gm.group_id = e.group_id AND gm.user_id = p_user_id AND gm.is_active
        WHERE e.is_deleted = FALSE
          AND e.created_at > NOW() - INTERVAL '7 days'
        GROUP BY g.id, g.name
        ORDER BY COUNT(*) DESC
        LIMIT 1
    )
    SELECT jsonb_build_object(
        'total_owe', (SELECT total FROM owe),
        'total_owed', (SELECT total FROM owed),
        'top_group_name', COALESCE((SELECT name FROM top_group), '')
    );
$$;

REVOKE ALL ON FUNCTION public._weekly_digest_stats(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._weekly_digest_stats(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.run_weekly_summary_dispatch(p_limit INT DEFAULT 300)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_week date := date_trunc('week', CURRENT_DATE)::date;
    v_row record;
    v_out jsonb := '[]'::jsonb;
    v_stats jsonb;
    v_email text;
BEGIN
    FOR v_row IN
        SELECT DISTINCT p.id, p.language, p.email_unsubscribe_token
        FROM profiles p
        JOIN group_members gm ON gm.user_id = p.id AND gm.is_active = TRUE
        WHERE p.is_active = TRUE
          AND EXISTS (
              SELECT 1 FROM expenses e
              JOIN group_members gm2 ON gm2.group_id = e.group_id AND gm2.user_id = p.id
              WHERE e.is_deleted = FALSE AND e.created_at > NOW() - INTERVAL '7 days'
          )
          AND NOT EXISTS (
              SELECT 1 FROM weekly_digest_deliveries w
              WHERE w.user_id = p.id AND w.week_start = v_week
          )
        LIMIT GREATEST(p_limit, 1)
    LOOP
        SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_row.id;
        v_stats := public._weekly_digest_stats(v_row.id);

        v_out := v_out || jsonb_build_array(jsonb_build_object(
            'user_id', v_row.id,
            'email', v_email,
            'language', COALESCE(NULLIF(btrim(v_row.language), ''), 'en'),
            'unsubscribe_token', v_row.email_unsubscribe_token,
            'stats', v_stats,
            'send_push', COALESCE((
                SELECT np.weekly_digest_push FROM notification_preferences np WHERE np.user_id = v_row.id
            ), TRUE),
            'send_email', COALESCE((
                SELECT np.weekly_digest_email AND np.email_enabled
                FROM notification_preferences np WHERE np.user_id = v_row.id
            ), TRUE)
        ));
    END LOOP;

    RETURN jsonb_build_object('ok', true, 'week_start', v_week, 'items', v_out);
END;
$$;

REVOKE ALL ON FUNCTION public.run_weekly_summary_dispatch(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_weekly_summary_dispatch(INT) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_weekly_summary_sent(p_user_id UUID, p_week_start DATE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO weekly_digest_deliveries (user_id, week_start)
    VALUES (p_user_id, p_week_start)
    ON CONFLICT (user_id, week_start) DO UPDATE SET sent_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.mark_weekly_summary_sent(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_weekly_summary_sent(UUID, DATE) TO service_role;

CREATE OR REPLACE FUNCTION public.update_notification_preferences(p_prefs JSONB) RETURNS VOID
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE v_user UUID := auth.uid();
    BEGIN
        IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

        INSERT INTO notification_preferences AS np (
            user_id, push_enabled, expenses_push, settlements_push,
            messages_push, friends_push, groups_push,
            reminders_push, quiet_hours_enabled, quiet_hours_start, quiet_hours_end,
            timezone, daily_push_cap, unsettled_nudge_after_days,
            email_enabled, lifecycle_email_enabled,
            weekly_digest_push, weekly_digest_email, updated_at
        ) VALUES (
            v_user,
            COALESCE((p_prefs->>'push_enabled')::boolean, TRUE),
            COALESCE((p_prefs->>'expenses_push')::boolean, TRUE),
            COALESCE((p_prefs->>'settlements_push')::boolean, TRUE),
            COALESCE((p_prefs->>'messages_push')::boolean, TRUE),
            COALESCE((p_prefs->>'friends_push')::boolean, TRUE),
            COALESCE((p_prefs->>'groups_push')::boolean, TRUE),
            COALESCE((p_prefs->>'reminders_push')::boolean, TRUE),
            COALESCE((p_prefs->>'quiet_hours_enabled')::boolean, TRUE),
            COALESCE((p_prefs->>'quiet_hours_start')::int, 22),
            COALESCE((p_prefs->>'quiet_hours_end')::int, 8),
            COALESCE(NULLIF(btrim(p_prefs->>'timezone'), ''), 'UTC'),
            COALESCE((p_prefs->>'daily_push_cap')::int, 8),
            COALESCE((p_prefs->>'unsettled_nudge_after_days')::int, 7),
            COALESCE((p_prefs->>'email_enabled')::boolean, TRUE),
            COALESCE((p_prefs->>'lifecycle_email_enabled')::boolean, TRUE),
            COALESCE((p_prefs->>'weekly_digest_push')::boolean, TRUE),
            COALESCE((p_prefs->>'weekly_digest_email')::boolean, TRUE),
            NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
            push_enabled     = COALESCE((p_prefs->>'push_enabled')::boolean, np.push_enabled),
            expenses_push    = COALESCE((p_prefs->>'expenses_push')::boolean, np.expenses_push),
            settlements_push = COALESCE((p_prefs->>'settlements_push')::boolean, np.settlements_push),
            messages_push    = COALESCE((p_prefs->>'messages_push')::boolean, np.messages_push),
            friends_push     = COALESCE((p_prefs->>'friends_push')::boolean, np.friends_push),
            groups_push      = COALESCE((p_prefs->>'groups_push')::boolean, np.groups_push),
            reminders_push   = COALESCE((p_prefs->>'reminders_push')::boolean, np.reminders_push),
            quiet_hours_enabled = COALESCE((p_prefs->>'quiet_hours_enabled')::boolean, np.quiet_hours_enabled),
            quiet_hours_start = COALESCE((p_prefs->>'quiet_hours_start')::int, np.quiet_hours_start),
            quiet_hours_end   = COALESCE((p_prefs->>'quiet_hours_end')::int, np.quiet_hours_end),
            timezone          = COALESCE(NULLIF(btrim(p_prefs->>'timezone'), ''), np.timezone),
            daily_push_cap    = COALESCE((p_prefs->>'daily_push_cap')::int, np.daily_push_cap),
            unsettled_nudge_after_days = COALESCE((p_prefs->>'unsettled_nudge_after_days')::int, np.unsettled_nudge_after_days),
            email_enabled = COALESCE((p_prefs->>'email_enabled')::boolean, np.email_enabled),
            lifecycle_email_enabled = COALESCE((p_prefs->>'lifecycle_email_enabled')::boolean, np.lifecycle_email_enabled),
            weekly_digest_push = COALESCE((p_prefs->>'weekly_digest_push')::boolean, np.weekly_digest_push),
            weekly_digest_email = COALESCE((p_prefs->>'weekly_digest_email')::boolean, np.weekly_digest_email),
            updated_at       = NOW();
    END;
    $$;

CREATE OR REPLACE FUNCTION app_private.invoke_weekly_summary_dispatch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_url    TEXT;
    v_secret TEXT;
BEGIN
    SELECT decrypted_secret INTO v_url
      FROM vault.decrypted_secrets WHERE name = 'weekly_summary_dispatch_url' LIMIT 1;
    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets WHERE name = 'weekly_summary_webhook_secret' LIMIT 1;

    IF v_url IS NULL OR v_secret IS NULL THEN
        RAISE NOTICE 'weekly_summary_dispatch: vault URL/secret not configured — skip';
        RETURN;
    END IF;

    PERFORM net.http_post(
        url     := v_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', v_secret
        ),
        body    := '{}'::jsonb,
        timeout_milliseconds := 180000
    );
END;
$$;

DO $cron$
DECLARE
    v_job_id BIGINT;
BEGIN
    SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'weekly-summary-dispatch-weekly' LIMIT 1;
    IF v_job_id IS NOT NULL THEN
        PERFORM cron.unschedule(v_job_id);
    END IF;
END
$cron$;

SELECT cron.schedule(
    'weekly-summary-dispatch-weekly',
    '0 10 * * 1',
    $$SELECT app_private.invoke_weekly_summary_dispatch();$$
);
