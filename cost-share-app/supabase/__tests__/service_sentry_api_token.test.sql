-- service_sentry_api_token: Vault fallback for admin-sentry-proxy (service_role only).
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_user CONSTANT UUID := '00000000-0000-0000-0000-00000017210001';
    v_token TEXT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_user, 'sentry1721@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token)
        VALUES (v_user, 'U', 'ILS', TRUE, 'sentry1721UserTok');

    SET LOCAL session_replication_role = origin;
    PERFORM public.test_set_authenticated(v_user);

    BEGIN
        PERFORM public.service_sentry_api_token();
        RAISE EXCEPTION 'Case A failed: authenticated must not call service_sentry_api_token';
    EXCEPTION
        WHEN insufficient_privilege THEN
            NULL;
        WHEN OTHERS THEN
            IF SQLERRM NOT LIKE '%permission denied%'
               AND SQLERRM NOT LIKE '%42501%'
               AND SQLERRM NOT LIKE '%does not exist%' THEN
                RAISE;
            END IF;
    END;

    PERFORM set_config('role', 'service_role', TRUE);
    SELECT public.service_sentry_api_token() INTO v_token;
    -- NULL is fine when Vault secret is not seeded in CI.

    IF to_regprocedure('vault.create_secret(text,text,text)') IS NOT NULL THEN
        PERFORM vault.create_secret(
            'ci-sentry-token-1721',
            'sentry_api_token',
            'admin-sentry-proxy CI test'
        );
        SELECT public.service_sentry_api_token() INTO v_token;
        IF v_token IS DISTINCT FROM 'ci-sentry-token-1721' THEN
            RAISE EXCEPTION 'Case C failed: expected vault token, got %', v_token;
        END IF;
    END IF;
END;
$outer$;

ROLLBACK;
