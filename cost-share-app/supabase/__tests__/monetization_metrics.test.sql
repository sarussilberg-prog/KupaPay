-- Regression: get_monetization_metrics must be callable by authenticated role (admin check inside).
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_admin CONSTANT UUID := '00000000-0000-0000-0000-0000000mon001';
    v_user  CONSTANT UUID := '00000000-0000-0000-0000-0000000mon002';
    v_metrics JSONB;
    v_caught BOOLEAN;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_admin, 'mon-admin@test.local'),
        (v_user,  'mon-user@test.local');

    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token) VALUES
        (v_admin, 'mon-admin@test.local', 'Admin', 'USD', 'en', TRUE, 'tt_mon_admin'),
        (v_user,  'mon-user@test.local',  'User',  'USD', 'en', TRUE, 'tt_mon_user');

    INSERT INTO public.app_admins (user_id) VALUES (v_admin);

    INSERT INTO public.monetization_events (user_id, feature_key, event_type, platform)
        VALUES (v_admin, 'remind_settle', 'ad_gate_shown', 'ios');

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text)::text, TRUE);
    v_caught := FALSE;
    BEGIN
        PERFORM public.get_monetization_metrics();
    EXCEPTION WHEN OTHERS THEN
        v_caught := SQLERRM LIKE '%not_admin%';
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Case 1 failed: non-admin should raise not_admin';
    END IF;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin::text)::text, TRUE);
    SELECT public.get_monetization_metrics() INTO v_metrics;
    IF (v_metrics->'funnel'->>'ad_gate_shown')::INT < 1 THEN
        RAISE EXCEPTION 'Case 2 failed: admin metrics funnel missing seeded event';
    END IF;

    IF NOT has_function_privilege('authenticated', 'public.get_monetization_metrics()', 'EXECUTE') THEN
        RAISE EXCEPTION 'Case 3 failed: authenticated must EXECUTE get_monetization_metrics';
    END IF;
END;
$outer$;

ROLLBACK;
