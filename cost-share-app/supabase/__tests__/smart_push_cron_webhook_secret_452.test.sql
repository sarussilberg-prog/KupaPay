-- #452 — Smart-push cron dispatchers must use dedicated vault secrets (no send_push_secret fallback).
BEGIN;

DO $outer$
DECLARE
    v_retention TEXT;
    v_flush TEXT;
BEGIN
    SELECT pg_get_functiondef('app_private.invoke_retention_unsettled_nudge_dispatch()'::regprocedure)
      INTO v_retention;
    SELECT pg_get_functiondef('app_private.invoke_flush_deferred_push_dispatch()'::regprocedure)
      INTO v_flush;

    IF v_retention NOT LIKE '%retention_unsettled_nudge_webhook_secret%' THEN
        RAISE EXCEPTION 'Case 1 failed: retention dispatch must use retention_unsettled_nudge_webhook_secret';
    END IF;
    IF v_retention LIKE '%send_push_secret%' THEN
        RAISE EXCEPTION 'Case 2 failed: retention dispatch must not use send_push_secret';
    END IF;

    IF v_flush NOT LIKE '%flush_deferred_push_webhook_secret%' THEN
        RAISE EXCEPTION 'Case 3 failed: flush dispatch must use flush_deferred_push_webhook_secret';
    END IF;
    IF v_flush LIKE '%send_push_secret%' THEN
        RAISE EXCEPTION 'Case 4 failed: flush dispatch must not use send_push_secret';
    END IF;

    RAISE NOTICE 'smart_push_cron_webhook_secret_452.test.sql — passed';
END;
$outer$;

ROLLBACK;
