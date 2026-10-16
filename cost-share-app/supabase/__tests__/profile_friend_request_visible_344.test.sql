-- #344 — Pending friend-request parties can read each other's profile rows.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_alice CONSTANT UUID := '00000000-0000-0000-0000-000000344001';
    v_bob   CONSTANT UUID := '00000000-0000-0000-0000-000000344002';
    v_name  TEXT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_alice, 'fr344-alice@test.local'),
        (v_bob,   'fr344-bob@test.local');

    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token) VALUES
        (v_alice, 'fr344-alice@test.local', 'Alice FR344', 'USD', 'en', TRUE, 'tt_fr344_a'),
        (v_bob,   'fr344-bob@test.local',   'Bob FR344',   'USD', 'en', TRUE, 'tt_fr344_b');

    INSERT INTO public.friend_requests (from_user_id, to_user_id, status)
        VALUES (v_bob, v_alice, 'pending');

    PERFORM public.test_set_authenticated(v_alice);
    SELECT name INTO v_name FROM public.profiles WHERE id = v_bob;
    IF v_name IS DISTINCT FROM 'Bob FR344' THEN
        RAISE EXCEPTION 'Case 1 failed: recipient should read requester name (got %)', v_name;
    END IF;

    PERFORM public.test_set_authenticated(v_bob);
    SELECT name INTO v_name FROM public.profiles WHERE id = v_alice;
    IF v_name IS DISTINCT FROM 'Alice FR344' THEN
        RAISE EXCEPTION 'Case 2 failed: requester should read recipient name (got %)', v_name;
    END IF;

    RAISE NOTICE 'profile_friend_request_visible_344.test.sql — passed';
END;
$outer$;

ROLLBACK;
