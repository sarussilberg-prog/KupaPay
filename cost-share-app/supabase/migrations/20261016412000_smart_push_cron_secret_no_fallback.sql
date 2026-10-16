-- #452 — Do not fall back to send_push_secret for smart-push cron dispatchers.

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
