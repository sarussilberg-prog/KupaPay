-- #345 — invoke_storage_cleanup_dispatch must read storage_cleanup_webhook_secret from Vault.
BEGIN;

DO $outer$
DECLARE
    v_def TEXT;
BEGIN
    SELECT pg_get_functiondef('app_private.invoke_storage_cleanup_dispatch()'::regprocedure) INTO v_def;
    IF v_def NOT LIKE '%storage_cleanup_webhook_secret%' THEN
        RAISE EXCEPTION 'Case 1 failed: invoke must use storage_cleanup_webhook_secret';
    END IF;
    IF v_def LIKE '%send_push_secret%' THEN
        RAISE EXCEPTION 'Case 2 failed: invoke must not use send_push_secret';
    END IF;
    RAISE NOTICE 'storage_cleanup_webhook_secret_345.test.sql — passed';
END;
$outer$;

ROLLBACK;
