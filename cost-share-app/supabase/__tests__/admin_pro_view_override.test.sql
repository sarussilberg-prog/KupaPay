-- Regression tests for admin Pro view override.
-- Run against dev (drxfbicunusmipdgbgdk). Transaction ROLLBACK at end.

BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_admin  CONSTANT UUID := '00000000-0000-0000-0000-0000000ad100';
    v_alice  CONSTANT UUID := '00000000-0000-0000-0000-0000000ad101';
    v_group  CONSTANT UUID := '00000000-0000-0000-0000-0000000ad110';
    v_status JSONB;
    v_caught BOOLEAN;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_admin, 'proview-admin@test.local'),
        (v_alice, 'proview-alice@test.local');

    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token, pro_until) VALUES
        (v_admin, 'proview-admin@test.local', 'Admin', 'USD', 'en', TRUE, 'tt_pv_admin', NULL),
        (v_alice, 'proview-alice@test.local', 'Alice', 'USD', 'en', TRUE, 'tt_pv_alice', NOW() + INTERVAL '30 days');

    INSERT INTO public.app_admins (user_id) VALUES (v_admin);

    INSERT INTO public.groups (id, name, default_currency, is_active, last_activity_at, created_by, invite_token) VALUES
        (v_group, 'Pro View Group', 'USD', TRUE, NOW(), v_admin, 'tt_pv_grp');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES (v_group, v_admin, TRUE);

    -- ---- Non-admin cannot set override --------------------------------
    PERFORM public.test_set_authenticated(v_alice);
    v_caught := FALSE;
    BEGIN
        PERFORM public.set_my_admin_pro_view_mode('force_pro');
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM = 'not_authorized' THEN v_caught := TRUE; END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Case 1 failed: non-admin must get not_authorized';
    END IF;

    -- ---- Admin force_pro without real entitlement ---------------------
    PERFORM public.test_set_authenticated(v_admin);
    SELECT public.set_my_admin_pro_view_mode('force_pro') INTO v_status;
    IF (v_status->>'hasPro')::BOOLEAN IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Case 2 failed: force_pro should yield hasPro true';
    END IF;
    IF v_status->>'adminProViewMode' <> 'force_pro' THEN
        RAISE EXCEPTION 'Case 2b failed: adminProViewMode should be force_pro';
    END IF;
    IF public.has_pro(v_admin, v_group) IS NOT TRUE THEN
        RAISE EXCEPTION 'Case 2c failed: has_pro should honor force_pro';
    END IF;

    -- ---- Admin force_free masks real Pro (Alice) ----------------------
    PERFORM public.test_set_authenticated(v_alice);
    IF public.has_pro(v_alice, NULL) IS NOT TRUE THEN
        RAISE EXCEPTION 'Case 3a failed: Alice should have real Pro';
    END IF;

    -- Alice is not admin — cannot set override; insert row directly must NOT apply to has_pro
    INSERT INTO public.admin_pro_view_overrides (user_id, mode, expires_at)
        VALUES (v_alice, 'force_free', NOW() + INTERVAL '1 hour');
    IF public.has_pro(v_alice, NULL) IS NOT TRUE THEN
        RAISE EXCEPTION 'Case 3b failed: non-admin row must not affect has_pro';
    END IF;
    DELETE FROM public.admin_pro_view_overrides WHERE user_id = v_alice;

    PERFORM public.test_set_authenticated(v_admin);
    SELECT public.set_my_admin_pro_view_mode('force_free') INTO v_status;
    IF (v_status->>'hasPro')::BOOLEAN IS DISTINCT FROM FALSE THEN
        RAISE EXCEPTION 'Case 4 failed: force_free should yield hasPro false';
    END IF;

    -- ---- Reset to real ------------------------------------------------
    SELECT public.set_my_admin_pro_view_mode('real') INTO v_status;
    IF v_status->>'adminProViewMode' <> 'real' THEN
        RAISE EXCEPTION 'Case 5 failed: real mode should clear override';
    END IF;
    IF public.has_pro(v_admin, v_group) IS NOT FALSE THEN
        RAISE EXCEPTION 'Case 5b failed: admin without entitlement should not have Pro in real mode';
    END IF;

    RAISE NOTICE 'admin_pro_view_override tests passed';
END;
$outer$;

ROLLBACK;
