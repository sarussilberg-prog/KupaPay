-- #329 — delete_my_account must not enqueue foreign profile-images paths.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_attacker CONSTANT UUID := '00000000-0000-0000-0000-000000032901';
    v_victim   CONSTANT UUID := '00000000-0000-0000-0000-000000032902';
    v_owned    CONSTANT UUID := '00000000-0000-0000-0000-000000032903';
    v_rows     INT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_attacker, 'av329-attacker@test.local'),
        (v_victim,   'av329-victim@test.local'),
        (v_owned,    'av329-owned@test.local');

    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token, avatar_url) VALUES
        (v_attacker, 'av329-attacker@test.local', 'Attacker', 'USD', 'en', TRUE, 'tt_av329_atk',
            v_victim::text || '/avatar.jpg'),
        (v_victim,   'av329-victim@test.local',   'Victim',   'USD', 'en', TRUE, 'tt_av329_vic', NULL),
        (v_owned,    'av329-owned@test.local',    'Owned',    'USD', 'en', TRUE, 'tt_av329_own',
            v_owned::text || '/avatar.png');

    PERFORM public.test_set_authenticated(v_attacker);
    PERFORM public.delete_my_account();

    SELECT COUNT(*) INTO v_rows
    FROM public.storage_cleanup_queue
    WHERE bucket = 'profile-images'
      AND object_path = v_victim::text || '/avatar.jpg';

    IF v_rows <> 0 THEN
        RAISE EXCEPTION 'Case 1 failed: foreign avatar path must not be queued (rows=%)', v_rows;
    END IF;

    PERFORM public.test_set_authenticated(v_owned);
    PERFORM public.delete_my_account();

    SELECT COUNT(*) INTO v_rows
    FROM public.storage_cleanup_queue
    WHERE bucket = 'profile-images'
      AND object_path = v_owned::text || '/avatar.png';

    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'Case 2 failed: owned avatar path should be queued once (rows=%)', v_rows;
    END IF;

    RAISE NOTICE 'avatar_cleanup_owned_path_329.test.sql — passed';
END;
$outer$;

ROLLBACK;
