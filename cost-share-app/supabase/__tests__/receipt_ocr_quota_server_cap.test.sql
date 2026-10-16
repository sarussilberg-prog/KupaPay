-- #296 — Quota RPC is service_role-only with fixed cap (no client p_max).
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_user CONSTANT UUID := '00000000-0000-0000-0000-000000296001';
    v_ok BOOLEAN;
BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_user, 'ocr296@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token)
        VALUES (v_user, 'U', 'ILS', TRUE, 'ocr296UserTok1');

    SET LOCAL session_replication_role = origin;
    PERFORM public.test_set_authenticated(v_user);

    BEGIN
        PERFORM public.consume_receipt_ocr_quota_for_user(v_user);
        RAISE EXCEPTION 'Case A failed: authenticated must not call quota RPC';
    EXCEPTION WHEN insufficient_privilege OR undefined_function OR OTHERS THEN
        IF SQLERRM NOT LIKE '%permission denied%'
           AND SQLERRM NOT LIKE '%42501%'
           AND SQLERRM NOT LIKE '%does not exist%' THEN
            RAISE;
        END IF;
    END;

    PERFORM set_config('role', 'service_role', TRUE);
    SELECT public.consume_receipt_ocr_quota_for_user(v_user) INTO v_ok;
    IF v_ok IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Case B failed: service path should consume quota (got %)', v_ok;
    END IF;
END;
$outer$;

ROLLBACK;
