-- Round 11 — sensitive RPCs must not be executable by anon.
BEGIN;

DO $outer$
DECLARE
    r RECORD;
    v_bad TEXT := '';
BEGIN
    FOR r IN
        SELECT p.proname,
               pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prokind = 'f'
          AND has_function_privilege('anon', p.oid, 'EXECUTE')
          AND p.proname = ANY (ARRAY[
              'handle_revenuecat_webhook',
              'hard_purge_expired_deleted_accounts',
              'restore_deleted_account',
              'consume_receipt_ocr_quota_for_user',
              'admin_list_deleted_accounts',
              'delete_my_account'
          ])
    LOOP
        v_bad := v_bad || r.proname || '(' || r.args || '); ';
    END LOOP;

    IF v_bad <> '' THEN
        RAISE EXCEPTION 'Case 1 failed: anon must not EXECUTE: %', v_bad;
    END IF;

    IF has_function_privilege(
        'authenticated',
        'public.handle_revenuecat_webhook(text, uuid, text, text, timestamptz, timestamptz, uuid, boolean, boolean, boolean)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'Case 2 failed: authenticated must not EXECUTE handle_revenuecat_webhook';
    END IF;

    IF has_function_privilege(
        'authenticated',
        'public.profile_visible_to_viewer(uuid)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'Case 3 failed: authenticated must not EXECUTE profile_visible_to_viewer';
    END IF;

    RAISE NOTICE 'security_anon_execute_round11.test.sql — passed';
END;
$outer$;

ROLLBACK;
