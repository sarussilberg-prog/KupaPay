-- #402 Smart push reminders: quiet hours, caps, retention nudges, web tokens.

ALTER TABLE public.notification_preferences
    ADD COLUMN IF NOT EXISTS reminders_push BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS quiet_hours_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS quiet_hours_start SMALLINT NOT NULL DEFAULT 22
        CHECK (quiet_hours_start >= 0 AND quiet_hours_start <= 23),
    ADD COLUMN IF NOT EXISTS quiet_hours_end SMALLINT NOT NULL DEFAULT 8
        CHECK (quiet_hours_end >= 0 AND quiet_hours_end <= 23),
    ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC',
    ADD COLUMN IF NOT EXISTS daily_push_cap SMALLINT NOT NULL DEFAULT 8
        CHECK (daily_push_cap >= 1 AND daily_push_cap <= 50),
    ADD COLUMN IF NOT EXISTS unsettled_nudge_after_days SMALLINT NOT NULL DEFAULT 7
        CHECK (unsettled_nudge_after_days >= 1 AND unsettled_nudge_after_days <= 90);

ALTER TABLE public.push_deliveries
    ADD COLUMN IF NOT EXISTS deliver_after TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_push_deliveries_deferred
    ON public.push_deliveries (deliver_after)
    WHERE last_error = 'quiet_hours_deferred';

CREATE TABLE IF NOT EXISTS public.retention_unsettled_nudge_state (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    creditor_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    currency VARCHAR(3) NOT NULL,
    first_unsettled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_nudge_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, group_id, creditor_user_id, currency)
);

ALTER TABLE public.retention_unsettled_nudge_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own retention nudge state"
    ON public.retention_unsettled_nudge_state FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Extend activity_events.kind
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
        'unsettled_balance_nudge'
    ));

ALTER TABLE public.device_tokens
    DROP CONSTRAINT IF EXISTS device_tokens_platform_check;

ALTER TABLE public.device_tokens
    ADD CONSTRAINT device_tokens_platform_check CHECK (platform IN ('ios', 'android', 'web'));

-- Web push tokens (Expo web).
CREATE OR REPLACE FUNCTION public.register_device_token(
    p_token       TEXT,
    p_platform    TEXT,
    p_device_id   TEXT DEFAULT NULL,
    p_app_version TEXT DEFAULT NULL
) RETURNS VOID
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
        v_user UUID := auth.uid();
        v_owner UUID;
        v_disabled TIMESTAMPTZ;
    BEGIN
        IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
        IF p_platform NOT IN ('ios','android','web') THEN RAISE EXCEPTION 'bad_platform'; END IF;
        IF p_token IS NULL OR btrim(p_token) = '' THEN RAISE EXCEPTION 'bad_token'; END IF;

        SELECT user_id, disabled_at INTO v_owner, v_disabled
        FROM device_tokens
        WHERE token = p_token;

        IF FOUND THEN
            IF v_owner IS DISTINCT FROM v_user AND v_disabled IS NULL THEN
                RAISE EXCEPTION 'token_bound_to_other_user' USING ERRCODE = '42501';
            END IF;

            UPDATE device_tokens
               SET user_id         = v_user,
                   platform        = p_platform,
                   device_id       = p_device_id,
                   app_version     = p_app_version,
                   last_seen_at    = NOW(),
                   disabled_at     = NULL,
                   disabled_reason = NULL
             WHERE token = p_token;
            RETURN;
        END IF;

        INSERT INTO device_tokens (user_id, token, platform, device_id, app_version, last_seen_at)
        VALUES (v_user, p_token, p_platform, p_device_id, p_app_version, NOW());
    END;
    $$;

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
            timezone, daily_push_cap, unsettled_nudge_after_days, updated_at
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
            updated_at       = NOW();
    END;
    $$;

CREATE OR REPLACE FUNCTION public.count_push_sent_last_24h(p_user_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COUNT(*)::int
    FROM push_deliveries pd
    WHERE pd.recipient_user_id = p_user_id
      AND pd.status = 'sent'
      AND pd.sent_at > NOW() - INTERVAL '24 hours';
$$;

REVOKE ALL ON FUNCTION public.count_push_sent_last_24h(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_push_sent_last_24h(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.run_retention_unsettled_nudges(p_limit INT DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lock boolean;
    v_sent int := 0;
    v_member record;
    v_debt record;
    v_prefs record;
    v_first timestamptz;
    v_last timestamptz;
    v_days int;
    v_min_gap interval := interval '72 hours';
BEGIN
    v_lock := pg_try_advisory_lock(8712345678901240);
    IF NOT v_lock THEN
        RETURN jsonb_build_object('ok', true, 'skipped', true);
    END IF;

    FOR v_member IN
        SELECT DISTINCT gm.user_id
        FROM group_members gm
        WHERE gm.is_active = TRUE
        LIMIT GREATEST(p_limit, 1)
    LOOP
        SELECT * INTO v_prefs
        FROM notification_preferences np
        WHERE np.user_id = v_member.user_id;

        IF v_prefs IS NOT NULL AND v_prefs.reminders_push = FALSE THEN
            CONTINUE;
        END IF;

        v_days := COALESCE(v_prefs.unsettled_nudge_after_days, 7);

        FOR v_debt IN
            SELECT d.*, g.name AS group_name
            FROM group_members gm
            JOIN LATERAL (
                SELECT * FROM public._get_group_pairwise_debts_core(gm.group_id)
                WHERE from_user_id = v_member.user_id
            ) d ON TRUE
            JOIN groups g ON g.id = gm.group_id
            WHERE gm.user_id = v_member.user_id AND gm.is_active = TRUE
        LOOP
            SELECT first_unsettled_at, last_nudge_at
              INTO v_first, v_last
            FROM retention_unsettled_nudge_state
            WHERE user_id = v_debt.from_user_id
              AND group_id = v_debt.group_id
              AND creditor_user_id = v_debt.to_user_id
              AND currency = v_debt.currency;

            IF NOT FOUND THEN
                INSERT INTO retention_unsettled_nudge_state (
                    user_id, group_id, creditor_user_id, currency, first_unsettled_at
                ) VALUES (
                    v_debt.from_user_id, v_debt.group_id, v_debt.to_user_id, v_debt.currency, NOW()
                );
                CONTINUE;
            END IF;

            IF NOW() - v_first < (v_days || ' days')::interval THEN
                CONTINUE;
            END IF;

            IF v_last IS NOT NULL AND NOW() - v_last < v_min_gap THEN
                CONTINUE;
            END IF;

            INSERT INTO public.activity_events (
                id, user_id, kind, group_id, ref_id, actor_user_id, metadata
            ) VALUES (
                gen_random_uuid(),
                v_debt.from_user_id,
                'unsettled_balance_nudge',
                v_debt.group_id,
                gen_random_uuid(),
                v_debt.to_user_id,
                jsonb_build_object(
                    'amount', round(v_debt.amount::numeric, 2),
                    'currency', v_debt.currency,
                    'retention', true
                )
            );

            UPDATE retention_unsettled_nudge_state
               SET last_nudge_at = NOW()
             WHERE user_id = v_debt.from_user_id
               AND group_id = v_debt.group_id
               AND creditor_user_id = v_debt.to_user_id
               AND currency = v_debt.currency;

            v_sent := v_sent + 1;
            EXIT WHEN v_sent >= p_limit;
        END LOOP;
        EXIT WHEN v_sent >= p_limit;
    END LOOP;

    -- Drop state rows where the debt no longer exists.
    DELETE FROM retention_unsettled_nudge_state s
    WHERE NOT EXISTS (
        SELECT 1
        FROM public._get_group_pairwise_debts_core(s.group_id) d
        WHERE d.from_user_id = s.user_id
          AND d.to_user_id = s.creditor_user_id
          AND d.currency = s.currency
          AND d.amount >= 0.01
    );

    PERFORM pg_advisory_unlock(8712345678901240);
    RETURN jsonb_build_object('ok', true, 'sent', v_sent);
EXCEPTION WHEN OTHERS THEN
    PERFORM pg_advisory_unlock(8712345678901240);
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.run_retention_unsettled_nudges(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_retention_unsettled_nudges(INT) TO service_role;

CREATE OR REPLACE FUNCTION public.list_deferred_push_deliveries(p_limit INT DEFAULT 50)
RETURNS TABLE (activity_event_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT pd.activity_event_id
    FROM push_deliveries pd
    WHERE pd.last_error = 'quiet_hours_deferred'
      AND pd.deliver_after IS NOT NULL
      AND pd.deliver_after <= NOW()
    ORDER BY pd.deliver_after ASC
    LIMIT GREATEST(p_limit, 1);
$$;

REVOKE ALL ON FUNCTION public.list_deferred_push_deliveries(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_deferred_push_deliveries(INT) TO service_role;

CREATE OR REPLACE FUNCTION app_private.invoke_retention_unsettled_nudge_dispatch()
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
      FROM vault.decrypted_secrets WHERE name = 'retention_unsettled_nudge_dispatch_url' LIMIT 1;
    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets WHERE name = 'retention_unsettled_nudge_webhook_secret' LIMIT 1;
    IF v_secret IS NULL THEN
        SELECT decrypted_secret INTO v_secret
          FROM vault.decrypted_secrets WHERE name = 'send_push_secret' LIMIT 1;
    END IF;

    IF v_url IS NULL OR v_secret IS NULL THEN
        RAISE NOTICE 'retention_unsettled_nudge_dispatch: vault URL/secret not configured — skip';
        RETURN;
    END IF;

    PERFORM net.http_post(
        url     := v_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', v_secret
        ),
        body    := '{}'::jsonb,
        timeout_milliseconds := 120000
    );
END;
$$;

CREATE OR REPLACE FUNCTION app_private.invoke_flush_deferred_push_dispatch()
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
      FROM vault.decrypted_secrets WHERE name = 'flush_deferred_push_dispatch_url' LIMIT 1;
    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets WHERE name = 'flush_deferred_push_webhook_secret' LIMIT 1;
    IF v_secret IS NULL THEN
        SELECT decrypted_secret INTO v_secret
          FROM vault.decrypted_secrets WHERE name = 'send_push_secret' LIMIT 1;
    END IF;

    IF v_url IS NULL OR v_secret IS NULL THEN
        RAISE NOTICE 'flush_deferred_push_dispatch: vault URL/secret not configured — skip';
        RETURN;
    END IF;

    PERFORM net.http_post(
        url     := v_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', v_secret
        ),
        body    := '{}'::jsonb,
        timeout_milliseconds := 120000
    );
END;
$$;

DO $cron$
DECLARE
    v_job_id BIGINT;
BEGIN
    SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'retention-unsettled-nudge-hourly' LIMIT 1;
    IF v_job_id IS NOT NULL THEN PERFORM cron.unschedule(v_job_id); END IF;
    SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'flush-deferred-push-quarter-hour' LIMIT 1;
    IF v_job_id IS NOT NULL THEN PERFORM cron.unschedule(v_job_id); END IF;
END
$cron$;

SELECT cron.schedule(
    'retention-unsettled-nudge-hourly',
    '15 * * * *',
    $$SELECT app_private.invoke_retention_unsettled_nudge_dispatch();$$
);

SELECT cron.schedule(
    'flush-deferred-push-quarter-hour',
    '*/15 * * * *',
    $$SELECT app_private.invoke_flush_deferred_push_dispatch();$$
);
