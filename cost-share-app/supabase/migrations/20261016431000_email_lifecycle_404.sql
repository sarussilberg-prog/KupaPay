-- #404 Email lifecycle: welcome, activation nudges, 14-day win-back.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.notification_preferences
    ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS lifecycle_email_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS email_unsubscribe_token TEXT
    DEFAULT encode(gen_random_bytes(18), 'hex');

CREATE OR REPLACE FUNCTION public.default_email_unsubscribe_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.email_unsubscribe_token IS NULL THEN
        NEW.email_unsubscribe_token := encode(gen_random_bytes(18), 'hex');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_default_email_unsubscribe_token ON public.profiles;
CREATE TRIGGER trg_default_email_unsubscribe_token
    BEFORE INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.default_email_unsubscribe_token();

UPDATE public.profiles
SET email_unsubscribe_token = encode(gen_random_bytes(18), 'hex')
WHERE email_unsubscribe_token IS NULL;

ALTER TABLE public.profiles
    ALTER COLUMN email_unsubscribe_token SET NOT NULL;

-- Keep DEFAULT so SQL tests using session_replication_role=replica (triggers off) still get tokens.

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unsubscribe_token_key
    ON public.profiles (email_unsubscribe_token);

CREATE TABLE IF NOT EXISTS public.email_lifecycle_deliveries (
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    template    TEXT NOT NULL CHECK (template IN (
        'welcome', 'add_first_expense', 'invite_friends', 'inactive_winback'
    )),
    sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, template)
);

ALTER TABLE public.email_lifecycle_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own lifecycle email deliveries"
    ON public.email_lifecycle_deliveries FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.unsubscribe_email_by_token(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user UUID;
BEGIN
    IF p_token IS NULL OR length(btrim(p_token)) < 16 THEN
        RETURN FALSE;
    END IF;
    SELECT id INTO v_user FROM public.profiles WHERE email_unsubscribe_token = p_token LIMIT 1;
    IF v_user IS NULL THEN
        RETURN FALSE;
    END IF;
    INSERT INTO public.notification_preferences AS np (user_id, email_enabled, lifecycle_email_enabled, updated_at)
    VALUES (v_user, FALSE, FALSE, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
        email_enabled = FALSE,
        lifecycle_email_enabled = FALSE,
        updated_at = NOW();
    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.unsubscribe_email_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unsubscribe_email_by_token(TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mark_email_lifecycle_sent(p_user_id UUID, p_template TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.email_lifecycle_deliveries (user_id, template)
    VALUES (p_user_id, p_template)
    ON CONFLICT (user_id, template) DO UPDATE SET sent_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.mark_email_lifecycle_sent(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_email_lifecycle_sent(UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public._profile_last_active_at(p_user_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT GREATEST(
        COALESCE((SELECT p.activity_last_seen_at FROM profiles p WHERE p.id = p_user_id), 'epoch'::timestamptz),
        COALESCE((SELECT MAX(dt.last_seen_at) FROM device_tokens dt WHERE dt.user_id = p_user_id), 'epoch'::timestamptz)
    );
$$;

REVOKE ALL ON FUNCTION public._profile_last_active_at(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._profile_last_active_at(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.run_email_lifecycle_dispatch(p_limit INT DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lock boolean;
    v_row record;
    v_out jsonb := '[]'::jsonb;
    v_last_active timestamptz;
    v_has_expense boolean;
    v_friend_count int;
    v_email text;
BEGIN
    v_lock := pg_try_advisory_lock(8712345678901241);
    IF NOT v_lock THEN
        RETURN jsonb_build_object('ok', true, 'skipped', true, 'items', '[]'::jsonb);
    END IF;

    FOR v_row IN
        SELECT p.id, p.email, p.language, p.created_at, p.email_unsubscribe_token
        FROM public.profiles p
        WHERE p.is_active = TRUE
          AND p.email IS NOT NULL
          AND btrim(p.email) <> ''
        ORDER BY p.created_at ASC
        LIMIT GREATEST(p_limit, 1)
    LOOP
        IF EXISTS (
            SELECT 1 FROM notification_preferences np
            WHERE np.user_id = v_row.id
              AND (np.email_enabled = FALSE OR np.lifecycle_email_enabled = FALSE)
        ) THEN
            CONTINUE;
        END IF;

        SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_row.id;
        IF v_email IS NULL OR btrim(v_email) = '' THEN
            CONTINUE;
        END IF;

        -- welcome: 1h after signup, within 7 days
        IF NOT EXISTS (
            SELECT 1 FROM email_lifecycle_deliveries d
            WHERE d.user_id = v_row.id AND d.template = 'welcome'
        ) AND v_row.created_at < NOW() - INTERVAL '1 hour'
          AND v_row.created_at > NOW() - INTERVAL '7 days' THEN
            v_out := v_out || jsonb_build_array(jsonb_build_object(
                'user_id', v_row.id,
                'email', v_email,
                'language', COALESCE(NULLIF(btrim(v_row.language), ''), 'en'),
                'template', 'welcome',
                'unsubscribe_token', v_row.email_unsubscribe_token
            ));
            CONTINUE;
        END IF;

        SELECT EXISTS (
            SELECT 1 FROM expenses e
            WHERE e.created_by = v_row.id AND e.is_deleted = FALSE
        ) INTO v_has_expense;

        IF NOT v_has_expense
           AND NOT EXISTS (
               SELECT 1 FROM email_lifecycle_deliveries d
               WHERE d.user_id = v_row.id AND d.template = 'add_first_expense'
           )
           AND v_row.created_at < NOW() - INTERVAL '2 days'
           AND v_row.created_at > NOW() - INTERVAL '30 days' THEN
            v_out := v_out || jsonb_build_array(jsonb_build_object(
                'user_id', v_row.id,
                'email', v_email,
                'language', COALESCE(NULLIF(btrim(v_row.language), ''), 'en'),
                'template', 'add_first_expense',
                'unsubscribe_token', v_row.email_unsubscribe_token
            ));
            CONTINUE;
        END IF;

        SELECT COUNT(*)::int INTO v_friend_count
        FROM friendships f
        WHERE f.user_a_id = v_row.id OR f.user_b_id = v_row.id;

        IF v_friend_count = 0
           AND NOT EXISTS (
               SELECT 1 FROM email_lifecycle_deliveries d
               WHERE d.user_id = v_row.id AND d.template = 'invite_friends'
           )
           AND v_row.created_at < NOW() - INTERVAL '3 days'
           AND v_row.created_at > NOW() - INTERVAL '45 days' THEN
            v_out := v_out || jsonb_build_array(jsonb_build_object(
                'user_id', v_row.id,
                'email', v_email,
                'language', COALESCE(NULLIF(btrim(v_row.language), ''), 'en'),
                'template', 'invite_friends',
                'unsubscribe_token', v_row.email_unsubscribe_token
            ));
            CONTINUE;
        END IF;

        v_last_active := public._profile_last_active_at(v_row.id);

        IF v_last_active < NOW() - INTERVAL '14 days'
           AND v_row.created_at < NOW() - INTERVAL '14 days'
           AND NOT EXISTS (
               SELECT 1 FROM email_lifecycle_deliveries d
               WHERE d.user_id = v_row.id
                 AND d.template = 'inactive_winback'
                 AND d.sent_at > NOW() - INTERVAL '30 days'
           ) THEN
            v_out := v_out || jsonb_build_array(jsonb_build_object(
                'user_id', v_row.id,
                'email', v_email,
                'language', COALESCE(NULLIF(btrim(v_row.language), ''), 'en'),
                'template', 'inactive_winback',
                'unsubscribe_token', v_row.email_unsubscribe_token
            ));
        END IF;
    END LOOP;

    PERFORM pg_advisory_unlock(8712345678901241);
    RETURN jsonb_build_object('ok', true, 'items', v_out);
END;
$$;

REVOKE ALL ON FUNCTION public.run_email_lifecycle_dispatch(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_email_lifecycle_dispatch(INT) TO service_role;

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
            email_enabled, lifecycle_email_enabled, updated_at
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
            updated_at       = NOW();
    END;
    $$;

CREATE OR REPLACE FUNCTION app_private.invoke_email_lifecycle_dispatch()
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
      FROM vault.decrypted_secrets WHERE name = 'email_lifecycle_dispatch_url' LIMIT 1;
    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets WHERE name = 'email_lifecycle_webhook_secret' LIMIT 1;

    IF v_url IS NULL OR v_secret IS NULL THEN
        RAISE NOTICE 'email_lifecycle_dispatch: vault URL/secret not configured — skip';
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
    SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'email-lifecycle-dispatch-daily' LIMIT 1;
    IF v_job_id IS NOT NULL THEN
        PERFORM cron.unschedule(v_job_id);
    END IF;
END
$cron$;

SELECT cron.schedule(
    'email-lifecycle-dispatch-daily',
    '15 9 * * *',
    $$SELECT app_private.invoke_email_lifecycle_dispatch();$$
);
