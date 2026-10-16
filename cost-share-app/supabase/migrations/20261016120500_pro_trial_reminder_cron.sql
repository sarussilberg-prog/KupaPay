-- Daily 07:00 UTC cron → pro-trial-reminder-dispatch (pg_net + Vault secrets).
-- Vault (per project, not in git): pro_trial_reminder_dispatch_url, send_push_secret
-- (reuse send_push_secret — same PUSH_WEBHOOK_SECRET / x-webhook-secret as send-push).

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION app_private.invoke_pro_trial_reminder_dispatch()
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
      FROM vault.decrypted_secrets WHERE name = 'pro_trial_reminder_dispatch_url' LIMIT 1;
    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets WHERE name = 'send_push_secret' LIMIT 1;

    IF v_url IS NULL OR v_secret IS NULL THEN
        RAISE NOTICE 'pro_trial_reminder_dispatch: vault URL/secret not configured — skip';
        RETURN;
    END IF;

    PERFORM net.http_post(
        url     := v_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', v_secret
        ),
        body    := '{}'::jsonb,
        timeout_milliseconds := 60000
    );
END;
$$;

DO $cron$
DECLARE
    v_job_id BIGINT;
BEGIN
    SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'pro-trial-reminder-dispatch-daily' LIMIT 1;
    IF v_job_id IS NOT NULL THEN
        PERFORM cron.unschedule(v_job_id);
    END IF;
END
$cron$;

SELECT cron.schedule(
    'pro-trial-reminder-dispatch-daily',
    '0 7 * * *',
    $$SELECT app_private.invoke_pro_trial_reminder_dispatch();$$
);
