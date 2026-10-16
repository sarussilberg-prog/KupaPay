-- Regression: profiles inline RLS + group_members INSERT must not recurse (42P17).
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_alice CONSTANT UUID := '00000000-0000-0000-0000-000000328002';
    v_bob   CONSTANT UUID := '00000000-0000-0000-0000-000000328003';
    v_owner CONSTANT UUID := '00000000-0000-0000-0000-000000328001';
    v_group CONSTANT UUID := '00000000-0000-0000-0000-000000328010';
    v_rows  INT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_owner, 'gm328-owner@test.local'),
        (v_alice, 'gm328-alice@test.local'),
        (v_bob,   'gm328-bob@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token) VALUES
        (v_owner, 'Owner', 'ILS', TRUE, 'gm328Owner123'),
        (v_alice, 'Alice', 'ILS', TRUE, 'gm328Alice12'),
        (v_bob,   'Bob',   'ILS', TRUE, 'gm328Bob0123');
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'GM328', 'ILS', TRUE, v_owner, 'gm328Group123');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_owner, TRUE),
        (v_group, v_alice, TRUE);
    INSERT INTO public.friendships (user_a_id, user_b_id, source)
        VALUES (LEAST(v_alice, v_bob), GREATEST(v_alice, v_bob), 'request');

    SET LOCAL session_replication_role = origin;
    PERFORM public.test_set_authenticated(v_alice);

    INSERT INTO public.group_members (group_id, user_id, is_active)
        VALUES (v_group, v_bob, TRUE);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'expected friend insert to succeed, got % rows', v_rows;
    END IF;
END;
$outer$;

ROLLBACK;
