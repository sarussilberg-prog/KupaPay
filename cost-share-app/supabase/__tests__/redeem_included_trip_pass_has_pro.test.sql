-- redeem_included_trip_pass honors has_pro() (incl. admin force_pro).
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_admin CONSTANT UUID := '00000000-0000-0000-0000-0000000ad200';
    v_group CONSTANT UUID := '00000000-0000-0000-0000-0000000ad210';
    v_result JSONB;
BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_admin, 'redeem-trip-admin@test.local');

    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token, pro_until, included_trip_pass_credits)
    VALUES (v_admin, 'redeem-trip-admin@test.local', 'Admin', 'ILS', 'en', TRUE, 'tt_redeem_trip', NULL, 1);

    INSERT INTO public.app_admins (user_id) VALUES (v_admin);

    INSERT INTO public.groups (id, name, default_currency, is_active, last_activity_at, created_by, invite_token)
    VALUES (v_group, 'Trip', 'ILS', TRUE, NOW(), v_admin, 'tt_redeem_grp');

    INSERT INTO public.group_members (group_id, user_id, is_active)
    VALUES (v_group, v_admin, TRUE);

    SET LOCAL session_replication_role = origin;

    PERFORM public.test_set_authenticated(v_admin);

    INSERT INTO public.admin_pro_view_overrides (user_id, mode, expires_at)
    VALUES (v_admin, 'force_pro', NOW() + INTERVAL '1 day');

    v_result := public.redeem_included_trip_pass(v_group);
    IF (v_result->>'ok')::BOOLEAN IS NOT TRUE THEN
        RAISE EXCEPTION 'Case 1 failed: force_pro should redeem, got %', v_result;
    END IF;

    RAISE NOTICE 'redeem_included_trip_pass_has_pro.test.sql — passed';
END;
$outer$;

ROLLBACK;
