-- #406 Pro trial lifecycle messaging (day 1, 10, 13).

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS pro_trial_lifecycle_sent JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS pro_trial_feature_usage JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.register_pro_trial_feature_usage(p_usage JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN RETURN; END IF;
    UPDATE public.profiles
       SET pro_trial_feature_usage = COALESCE(pro_trial_feature_usage, '{}'::jsonb) || COALESCE(p_usage, '{}'::jsonb)
     WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.register_pro_trial_feature_usage(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_pro_trial_feature_usage(JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_pro_trial_lifecycle_sent(p_day INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN RETURN; END IF;
    IF p_day NOT IN (1, 10, 13) THEN RETURN; END IF;
    UPDATE public.profiles
       SET pro_trial_lifecycle_sent = (
           SELECT COALESCE(jsonb_agg(DISTINCT v), '[]'::jsonb)
           FROM (
               SELECT jsonb_array_elements_text(COALESCE(pro_trial_lifecycle_sent, '[]'::jsonb)) AS v
               UNION ALL SELECT p_day::text
           ) s
       )
     WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.mark_pro_trial_lifecycle_sent(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_pro_trial_lifecycle_sent(INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_pro_trial_lifecycle_sent_service(p_user_id UUID, p_day INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_day NOT IN (1, 10, 13) THEN RETURN; END IF;
    UPDATE public.profiles
       SET pro_trial_lifecycle_sent = (
           SELECT COALESCE(jsonb_agg(DISTINCT v), '[]'::jsonb)
           FROM (
               SELECT jsonb_array_elements_text(COALESCE(pro_trial_lifecycle_sent, '[]'::jsonb)) AS v
               UNION ALL SELECT p_day::text
           ) s
       )
     WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_pro_trial_lifecycle_sent_service(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_pro_trial_lifecycle_sent_service(UUID, INT) TO service_role;

CREATE OR REPLACE FUNCTION public.run_pro_trial_lifecycle_dispatch(p_limit INT DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row record;
    v_out jsonb := '[]'::jsonb;
    v_start timestamptz;
    v_day int;
    v_sent jsonb;
BEGIN
    FOR v_row IN
        SELECT p.id, p.language, p.pro_trial_ends_at, p.pro_trial_lifecycle_sent, p.pro_trial_feature_usage
        FROM profiles p
        WHERE p.is_active = TRUE
          AND p.pro_trial_ends_at IS NOT NULL
          AND p.pro_trial_ends_at > NOW()
        LIMIT GREATEST(p_limit, 1)
    LOOP
        v_start := p.pro_trial_ends_at - INTERVAL '14 days';
        v_day := GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (NOW() - v_start)) / 86400)::int + 1);
        v_sent := COALESCE(v_row.pro_trial_lifecycle_sent, '[]'::jsonb);

        IF v_day IN (1, 10, 13)
           AND NOT v_sent @> to_jsonb(v_day::text) THEN
            v_out := v_out || jsonb_build_array(jsonb_build_object(
                'user_id', v_row.id,
                'language', COALESCE(NULLIF(btrim(v_row.language), ''), 'en'),
                'touch_day', v_day,
                'feature_usage', COALESCE(v_row.pro_trial_feature_usage, '{}'::jsonb)
            ));
        END IF;
    END LOOP;

    RETURN jsonb_build_object('ok', true, 'items', v_out);
END;
$$;

REVOKE ALL ON FUNCTION public.run_pro_trial_lifecycle_dispatch(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_pro_trial_lifecycle_dispatch(INT) TO service_role;

CREATE OR REPLACE FUNCTION app_private.invoke_pro_trial_lifecycle_dispatch()
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
      FROM vault.decrypted_secrets WHERE name = 'pro_trial_lifecycle_dispatch_url' LIMIT 1;
    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets WHERE name = 'pro_trial_lifecycle_webhook_secret' LIMIT 1;

    IF v_url IS NULL OR v_secret IS NULL THEN
        RAISE NOTICE 'pro_trial_lifecycle_dispatch: vault URL/secret not configured — skip';
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
    SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'pro-trial-lifecycle-dispatch-daily' LIMIT 1;
    IF v_job_id IS NOT NULL THEN
        PERFORM cron.unschedule(v_job_id);
    END IF;
END
$cron$;

SELECT cron.schedule(
    'pro-trial-lifecycle-dispatch-daily',
    '30 8 * * *',
    $$SELECT app_private.invoke_pro_trial_lifecycle_dispatch();$$
);
