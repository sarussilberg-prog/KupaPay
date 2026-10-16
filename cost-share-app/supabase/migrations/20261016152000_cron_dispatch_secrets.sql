-- #211 — Separate Vault webhook secrets per cron dispatch (send-push keeps send_push_secret).

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
      FROM vault.decrypted_secrets WHERE name = 'pro_trial_reminder_webhook_secret' LIMIT 1;
    IF v_secret IS NULL THEN
        SELECT decrypted_secret INTO v_secret
          FROM vault.decrypted_secrets WHERE name = 'send_push_secret' LIMIT 1;
    END IF;

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
