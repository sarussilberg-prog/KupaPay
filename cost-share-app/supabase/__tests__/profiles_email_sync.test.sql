-- profiles.email cannot be updated by authenticated users; auth.users email syncs profile.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_user CONSTANT UUID := '00000000-0000-4000-8000-000000014301';
    v_email TEXT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_user, 'sync141@test.local');
    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token)
        VALUES (v_user, 'sync141@test.local', 'Sync', 'USD', 'en', TRUE, 'tok141');

    SET LOCAL session_replication_role = origin;
    PERFORM public.test_set_authenticated(v_user);

    BEGIN
        UPDATE public.profiles SET email = 'fake@evil.test' WHERE id = v_user;
        RAISE EXCEPTION 'Case 1 failed: direct email update should be denied';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;
    WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%42501%' AND SQLERRM NOT LIKE '%permission denied%' THEN
            RAISE;
        END IF;
    END;

    RESET ROLE;
    UPDATE auth.users SET email = 'sync141-new@test.local' WHERE id = v_user;

    SELECT email INTO v_email FROM public.profiles WHERE id = v_user;
    IF v_email IS DISTINCT FROM 'sync141-new@test.local' THEN
        RAISE EXCEPTION 'Case 2 failed: profile email not synced, got %', v_email;
    END IF;

    RAISE NOTICE 'profiles_email_sync.test.sql — passed';
END;
$outer$;

ROLLBACK;
