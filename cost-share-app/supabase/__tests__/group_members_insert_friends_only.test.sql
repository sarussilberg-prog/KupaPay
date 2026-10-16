-- #320 — Members may INSERT friends only; not arbitrary profiles (invite flow uses RPC).
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_owner CONSTANT UUID := '00000000-0000-0000-0000-000000320001';
    v_alice CONSTANT UUID := '00000000-0000-0000-0000-000000320002';
    v_bob   CONSTANT UUID := '00000000-0000-0000-0000-000000320003';
    v_stranger CONSTANT UUID := '00000000-0000-0000-0000-000000320099';
    v_group CONSTANT UUID := '00000000-0000-0000-0000-000000320010';
    v_rows  INT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_owner, 'gm320-owner@test.local'),
        (v_alice, 'gm320-alice@test.local'),
        (v_bob,   'gm320-bob@test.local'),
        (v_stranger, 'gm320-stranger@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token) VALUES
        (v_owner, 'Owner', 'ILS', TRUE, 'gm320Owner123'),
        (v_alice, 'Alice', 'ILS', TRUE, 'gm320Alice12'),
        (v_bob,   'Bob',   'ILS', TRUE, 'gm320Bob0123'),
        (v_stranger, 'Stranger', 'ILS', TRUE, 'gm320Stranger1');
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'GM320', 'ILS', TRUE, v_owner, 'gm320Group123');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_owner, TRUE),
        (v_group, v_alice, TRUE);
    INSERT INTO public.friendships (user_a_id, user_b_id, source)
        VALUES (LEAST(v_alice, v_bob), GREATEST(v_alice, v_bob), 'request');

    SET LOCAL session_replication_role = origin;
    PERFORM public.test_set_authenticated(v_alice);

    BEGIN
        INSERT INTO public.group_members (group_id, user_id, is_active)
            VALUES (v_group, v_stranger, TRUE);
        RAISE EXCEPTION 'Case A failed: must not add non-friend stranger';
    EXCEPTION WHEN insufficient_privilege OR check_violation OR OTHERS THEN
        IF SQLERRM NOT LIKE '%row-level security%'
           AND SQLERRM NOT LIKE '%42501%' THEN
            RAISE;
        END IF;
    END;

    INSERT INTO public.group_members (group_id, user_id, is_active)
        VALUES (v_group, v_bob, TRUE);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'Case B failed: member must add friend to group';
    END IF;
END;
$outer$;

ROLLBACK;
