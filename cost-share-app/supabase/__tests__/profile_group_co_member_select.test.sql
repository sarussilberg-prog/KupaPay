-- Co-member profile reads: explicit column GRANT + RLS; strangers denied; select=* blocked.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_alice  CONSTANT UUID := '00000000-0000-0000-0000-000000036301';
    v_bob    CONSTANT UUID := '00000000-0000-0000-0000-000000036302';
    v_stranger CONSTANT UUID := '00000000-0000-0000-0000-000000036399';
    v_group  CONSTANT UUID := '00000000-0000-0000-0000-000000036310';
    v_name   TEXT;
    v_rows   INT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_alice,    'pgcm-alice@test.local'),
        (v_bob,      'pgcm-bob@test.local'),
        (v_stranger, 'pgcm-out@test.local');

    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token) VALUES
        (v_alice,    'pgcm-alice@test.local',    'Alice', 'USD', 'en', TRUE, 'tt_pgcm_a'),
        (v_bob,      'pgcm-bob@test.local',      'Bob',   'USD', 'en', TRUE, 'tt_pgcm_b'),
        (v_stranger, 'pgcm-out@test.local',      'Out',   'USD', 'en', TRUE, 'tt_pgcm_o');

    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'Co-member group', 'USD', TRUE, v_alice, 'tt_pgcm_grp');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_alice, TRUE),
        (v_group, v_bob, TRUE);

    PERFORM public.test_set_authenticated(v_bob);
    SELECT name INTO v_name
    FROM public.profiles
    WHERE id IN (v_alice, v_bob)
      AND id = v_alice;
    IF v_name <> 'Alice' THEN
        RAISE EXCEPTION 'Case 1 failed: co-member Bob must read Alice name (got %)', v_name;
    END IF;

    PERFORM public.test_set_authenticated(v_stranger);
    SELECT name INTO v_name FROM public.profiles WHERE id = v_alice;
    IF v_name IS NOT NULL THEN
        RAISE EXCEPTION 'Case 2 failed: stranger must not read Alice profile (got %)', v_name;
    END IF;

    PERFORM public.test_set_authenticated(v_bob);
    BEGIN
        EXECUTE 'SELECT * FROM public.profiles WHERE id = $1' USING v_alice;
        RAISE EXCEPTION 'Case 3 failed: select * on profiles must be denied for authenticated';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;
    END;

    IF NOT has_column_privilege('authenticated', 'public.profiles', 'name', 'SELECT') THEN
        RAISE EXCEPTION 'Case 4 failed: authenticated must have SELECT on profiles.name';
    END IF;

    RAISE NOTICE 'profile_group_co_member_select.test.sql — passed';
END;
$outer$;

ROLLBACK;
