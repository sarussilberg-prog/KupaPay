-- #330 — Profile PII not readable by anon or unrelated authenticated users.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_alice  CONSTANT UUID := '00000000-0000-0000-0000-000000033001';
    v_bob    CONSTANT UUID := '00000000-0000-0000-0000-000000033002';
    v_member CONSTANT UUID := '00000000-0000-0000-0000-000000033003';
    v_out    CONSTANT UUID := '00000000-0000-0000-0000-000000033099';
    v_group  CONSTANT UUID := '00000000-0000-0000-0000-000000033010';
    v_email  TEXT;
    v_rows   INT;
    v_search INT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_alice,  'pii330-alice@test.local'),
        (v_bob,    'pii330-bob@test.local'),
        (v_member, 'pii330-member@test.local'),
        (v_out,    'pii330-out@test.local');

    INSERT INTO public.profiles (id, email, name, phone, default_currency, language, is_active, invite_token) VALUES
        (v_alice,  'pii330-alice@test.local',  'Alice',  '+10000000001', 'USD', 'en', TRUE, 'tt_pii330_a'),
        (v_bob,    'pii330-bob@test.local',    'Bob',    '+10000000002', 'USD', 'en', TRUE, 'tt_pii330_b'),
        (v_member, 'pii330-member@test.local', 'Member', '+10000000003', 'USD', 'en', TRUE, 'tt_pii330_m'),
        (v_out,    'pii330-out@test.local',    'Out',    '+10000000099', 'USD', 'en', TRUE, 'tt_pii330_o');

    INSERT INTO public.friendships (user_a_id, user_b_id, source)
        VALUES (LEAST(v_alice, v_bob), GREATEST(v_alice, v_bob), 'request');

    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'PII Group', 'USD', TRUE, v_alice, 'tt_pii330_grp');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_alice, TRUE),
        (v_group, v_member, TRUE);

    PERFORM set_config('role', 'anon', TRUE);
    v_rows := 0;
    BEGIN
        SELECT COUNT(*) INTO v_rows FROM public.profiles;
        RAISE EXCEPTION 'Case 1 failed: anon SELECT should be denied (got % rows)', v_rows;
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;
    END;

    PERFORM public.test_set_authenticated(v_out);
    SELECT email INTO v_email FROM public.profiles WHERE id = v_bob;
    IF v_email IS NOT NULL THEN
        RAISE EXCEPTION 'Case 2 failed: outsider must not read Bob email (got %)', v_email;
    END IF;

    PERFORM public.test_set_authenticated(v_alice);
    SELECT email INTO v_email FROM public.profiles WHERE id = v_bob;
    IF v_email <> 'pii330-bob@test.local' THEN
        RAISE EXCEPTION 'Case 3 failed: friend Alice should read Bob email (got %)', v_email;
    END IF;

    PERFORM public.test_set_authenticated(v_member);
    SELECT email INTO v_email FROM public.profiles WHERE id = v_alice;
    IF v_email <> 'pii330-alice@test.local' THEN
        RAISE EXCEPTION 'Case 4 failed: co-group member should read Alice email (got %)', v_email;
    END IF;

    PERFORM public.test_set_authenticated(v_alice);
    SELECT COUNT(*) INTO v_search
    FROM public.search_users('Bob')
    WHERE email = 'pii330-bob@test.local';
    IF v_search <> 1 THEN
        RAISE EXCEPTION 'Case 5 failed: search_users should still return Bob (count=%)', v_search;
    END IF;

    RAISE NOTICE 'profile_pii_scoped_330.test.sql — passed';
END;
$outer$;

ROLLBACK;
