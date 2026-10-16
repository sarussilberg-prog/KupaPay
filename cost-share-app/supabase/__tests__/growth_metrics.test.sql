-- Regression: get_growth_metrics + analytics_north_star_groups (#422).
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_admin CONSTANT UUID := '00000000-0000-0000-0000-00000000g001';
    v_user  CONSTANT UUID := '00000000-0000-0000-0000-00000000g002';
    v_u1    CONSTANT UUID := '00000000-0000-0000-0000-00000000g003';
    v_u2    CONSTANT UUID := '00000000-0000-0000-0000-00000000g004';
    v_group CONSTANT UUID := '00000000-0000-0000-0000-00000000g005';
    v_month TIMESTAMPTZ := date_trunc('month', NOW() AT TIME ZONE 'UTC');
    v_metrics JSONB;
    v_caught BOOLEAN;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_admin, 'growth-admin@test.local'),
        (v_user,  'growth-user@test.local'),
        (v_u1,    'growth-u1@test.local'),
        (v_u2,    'growth-u2@test.local');

    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token) VALUES
        (v_admin, 'growth-admin@test.local', 'Admin', 'USD', 'en', TRUE, 'tt_gr_adm01'),
        (v_user,  'growth-user@test.local',  'User',  'USD', 'en', TRUE, 'tt_gr_usr01'),
        (v_u1,    'growth-u1@test.local',    'U1',    'USD', 'en', TRUE, 'tt_gr_u1_01'),
        (v_u2,    'growth-u2@test.local',    'U2',    'USD', 'en', TRUE, 'tt_gr_u2_01');

    INSERT INTO public.app_admins (user_id) VALUES (v_admin);

    INSERT INTO public.groups (id, name, created_by, currency)
    VALUES (v_group, 'Growth NS', v_u1, 'ILS');

    INSERT INTO public.group_members (group_id, user_id, is_active)
    VALUES
        (v_group, v_u1, TRUE),
        (v_group, v_u2, TRUE);

    INSERT INTO public.expenses (group_id, description, amount, paid_by, created_by, expense_date, created_at)
    VALUES
        (v_group, 'a', 10, v_u1, v_u1, CURRENT_DATE, v_month + INTERVAL '1 day'),
        (v_group, 'b', 20, v_u2, v_u2, CURRENT_DATE, v_month + INTERVAL '2 days');

    SET LOCAL session_replication_role = origin;

    IF (SELECT COUNT(*) FROM public.analytics_north_star_groups WHERE group_id = v_group AND month_start = v_month) <> 1 THEN
        RAISE EXCEPTION 'Case 1 failed: north-star row missing for two-author group';
    END IF;

    PERFORM public.test_set_authenticated(v_user);
    v_caught := FALSE;
    BEGIN
        PERFORM public.get_growth_metrics();
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM = 'not_admin' THEN v_caught := TRUE; END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Case 2 failed: non-admin should raise not_admin';
    END IF;

    PERFORM public.test_set_authenticated(v_admin);
    SELECT public.get_growth_metrics() INTO v_metrics;
    IF v_metrics->'north_star'->>'current_month_count' IS NULL THEN
        RAISE EXCEPTION 'Case 3 failed: admin RPC missing north_star counts';
    END IF;
END;
$outer$;

ROLLBACK;
