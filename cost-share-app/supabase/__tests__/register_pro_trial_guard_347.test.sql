-- #347 — register_pro_trial_reminder requires active pro_until from webhook path.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_user CONSTANT UUID := '00000000-0000-0000-0000-000000347001';
    v_caught BOOLEAN;
BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_user, 'trial347@test.local');
    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token, pro_until) VALUES
        (v_user, 'trial347@test.local', 'Trial', 'USD', 'en', TRUE, 'tt_trial347', NULL);

    SET LOCAL session_replication_role = origin;
    PERFORM public.test_set_authenticated(v_user);
    v_caught := FALSE;
    BEGIN
        PERFORM public.register_pro_trial_reminder(NOW() + INTERVAL '2 days');
        RAISE EXCEPTION 'Case 1 failed: must reject without pro_until';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%trial_not_eligible%' THEN v_caught := TRUE; ELSE RAISE; END IF;
    END;
    IF NOT v_caught THEN RAISE EXCEPTION 'Case 1 failed: expected trial_not_eligible'; END IF;

    PERFORM set_config('role', 'supabase_admin', TRUE);
    UPDATE public.profiles SET pro_until = NOW() + INTERVAL '7 days' WHERE id = v_user;
    PERFORM public.test_set_authenticated(v_user);
    PERFORM public.register_pro_trial_reminder(NOW() + INTERVAL '2 days');

    RAISE NOTICE 'register_pro_trial_guard_347.test.sql — passed';
END;
$outer$;

ROLLBACK;
