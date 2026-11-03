-- revenuecat_test_user: production webhook may apply SANDBOX only for flagged profiles.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_user UUID := '00000000-0000-4000-8000-000000014301';
    v_flag BOOLEAN;
BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_user, 'rc1301@test.local');
    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token)
        VALUES (v_user, 'rc1301@test.local', 'RC1301', 'USD', 'en', TRUE, 'tt_rc1301');

    SET LOCAL session_replication_role = origin;
    PERFORM set_config('role', 'service_role', TRUE);

    SELECT public.is_revenuecat_test_user(v_user) INTO v_flag;
    IF v_flag IS NOT FALSE THEN
        RAISE EXCEPTION 'Case 1 failed: default test user flag expected false, got %', v_flag;
    END IF;

    UPDATE public.profiles SET revenuecat_test_user = TRUE WHERE id = v_user;
    SELECT public.is_revenuecat_test_user(v_user) INTO v_flag;
    IF v_flag IS NOT TRUE THEN
        RAISE EXCEPTION 'Case 2 failed: flagged test user expected true, got %', v_flag;
    END IF;

    PERFORM set_config('role', 'authenticated', TRUE);
    IF has_function_privilege(
        'authenticated',
        'public.is_revenuecat_test_user(uuid)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'Case 3 failed: authenticated must not EXECUTE is_revenuecat_test_user';
    END IF;

    RAISE NOTICE 'revenuecat_test_user_sandbox.test.sql — passed';
END;
$outer$;

ROLLBACK;
