-- redeem_included_trip_pass honors has_pro() (incl. admin force_pro).
DO $$
DECLARE
    v_admin UUID := gen_random_uuid();
    v_group UUID := gen_random_uuid();
    v_result JSONB;
BEGIN
    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token, pro_until, included_trip_pass_credits)
    VALUES (v_admin, v_admin || '@example.test', 'Admin', 'ILS', 'en', TRUE, gen_random_uuid()::TEXT, NULL, 1);

    INSERT INTO public.app_admins (user_id) VALUES (v_admin);
    INSERT INTO public.groups (id, name, default_currency, created_by, invite_token)
    VALUES (v_group, 'Trip', 'ILS', v_admin, gen_random_uuid()::TEXT);
    INSERT INTO public.group_members (group_id, user_id, role, is_active)
    VALUES (v_group, v_admin, 'admin', TRUE);

    PERFORM set_config('request.jwt.claim.sub', v_admin::TEXT, TRUE);
    PERFORM set_config('role', 'authenticated', TRUE);

    INSERT INTO public.admin_pro_view_overrides (user_id, mode, expires_at)
    VALUES (v_admin, 'force_pro', NOW() + INTERVAL '1 day');

    v_result := public.redeem_included_trip_pass(v_group);
    IF (v_result->>'ok')::BOOLEAN IS NOT TRUE THEN
        RAISE EXCEPTION 'Case 1 failed: force_pro should redeem, got %', v_result;
    END IF;

    RAISE NOTICE 'redeem_included_trip_pass_has_pro.test.sql — passed';
END;
$$;
