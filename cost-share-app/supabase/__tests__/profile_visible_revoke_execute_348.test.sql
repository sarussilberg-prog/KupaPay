-- #348 — authenticated must not EXECUTE profile_visible_to_viewer (RLS internal only).
BEGIN;

DO $outer$
DECLARE
    v_user CONSTANT UUID := '00000000-0000-0000-0000-000000348001';
    v_caught BOOLEAN;
BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_user, 'pv348@test.local');
    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token) VALUES
        (v_user, 'pv348@test.local', 'User', 'USD', 'en', TRUE, 'tt_pv348');

    PERFORM public.test_set_authenticated(v_user);
    v_caught := FALSE;
    BEGIN
        PERFORM public.profile_visible_to_viewer(v_user);
        RAISE EXCEPTION 'Case 1 failed: authenticated must not execute profile_visible_to_viewer';
    EXCEPTION WHEN insufficient_privilege THEN
        v_caught := TRUE;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Case 1 failed: expected insufficient_privilege';
    END IF;

    RAISE NOTICE 'profile_visible_revoke_execute_348.test.sql — passed';
END;
$outer$;

ROLLBACK;
