-- #349 — get_my_pro_status must not leak group pass to non-members.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_member CONSTANT UUID := '00000000-0000-0000-0000-000000349001';
    v_out    CONSTANT UUID := '00000000-0000-0000-0000-000000349099';
    v_group  CONSTANT UUID := '00000000-0000-0000-0000-000000349010';
    v_status JSONB;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_member, 'pro349-m@test.local'),
        (v_out,    'pro349-o@test.local');

    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token) VALUES
        (v_member, 'Member', 'USD', TRUE, 'tt_pro349_m'),
        (v_out,    'Out',    'USD', TRUE, 'tt_pro349_o');

    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'Pro349', 'USD', TRUE, v_member, 'tt_pro349_g');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES (v_group, v_member, TRUE);

    INSERT INTO public.group_passes (group_id, purchased_by, until, store_product_id, pass_source)
        VALUES (v_group, v_member, NOW() + INTERVAL '30 days', 'kupapay_trip_pass', 'purchase');

    PERFORM public.test_set_authenticated(v_out);
    SELECT public.get_my_pro_status(v_group) INTO v_status;
    IF (v_status->>'groupPassUntil') IS NOT NULL THEN
        RAISE EXCEPTION 'Case 1 failed: outsider must not get groupPassUntil';
    END IF;
    IF (v_status->>'hasPro')::boolean IS TRUE THEN
        RAISE EXCEPTION 'Case 1 failed: outsider hasPro must be false without individual pro';
    END IF;

    PERFORM public.test_set_authenticated(v_member);
    SELECT public.get_my_pro_status(v_group) INTO v_status;
    IF (v_status->>'groupPassUntil') IS NULL THEN
        RAISE EXCEPTION 'Case 2 failed: member should see groupPassUntil';
    END IF;
    IF (v_status->>'hasPro')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'Case 2 failed: member should have hasPro via group pass';
    END IF;

    RAISE NOTICE 'get_my_pro_status_member_guard_349.test.sql — passed';
END;
$outer$;

ROLLBACK;
