-- Regression: #201 get_user_simplified_inputs auth, #204 settle reminder, #205 support rate limit.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_alice   CONSTANT UUID := '00000000-0000-0000-0000-000000a12001';
    v_bob     CONSTANT UUID := '00000000-0000-0000-0000-000000a12002';
    v_carol   CONSTANT UUID := '00000000-0000-0000-0000-000000a12003';
    v_g_shared CONSTANT UUID := '00000000-0000-0000-0000-000000a12100';
    v_g_bob_only CONSTANT UUID := '00000000-0000-0000-0000-000000a12101';
    v_exp     CONSTANT UUID := '00000000-0000-0000-0000-000000a12102';
    v_payload JSONB;
    v_group_ids TEXT[];
    i INT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_alice, 'sec-alice@test.local'),
        (v_bob,   'sec-bob@test.local'),
        (v_carol, 'sec-carol@test.local');

    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token) VALUES
        (v_alice, 'sec-alice@test.local', 'Alice', 'ILS', 'en', TRUE, 'secAliceTok01'),
        (v_bob,   'sec-bob@test.local',   'Bob',   'ILS', 'en', TRUE, 'secBobTok0123'),
        (v_carol, 'sec-carol@test.local', 'Carol', 'ILS', 'en', TRUE, 'secCarolTok01');

    INSERT INTO public.groups (id, name, default_currency, created_by, is_active, invite_token) VALUES
        (v_g_shared,   'Shared',   'ILS', v_alice, TRUE, 'secGrpShared1'),
        (v_g_bob_only, 'Bob solo', 'ILS', v_bob,   TRUE, 'secGrpBobOnly');

    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_g_shared, v_alice, TRUE),
        (v_g_shared, v_bob,   TRUE),
        (v_g_bob_only, v_bob, TRUE);

    INSERT INTO public.expenses (id, group_id, description, amount, currency, paid_by, created_by, is_deleted)
        VALUES (v_exp, v_g_bob_only, 'secret', 100, 'ILS', v_bob, v_bob, FALSE);
    INSERT INTO public.expense_splits (expense_id, user_id, amount)
        VALUES (v_exp, v_bob, 100);

    PERFORM set_config('request.jwt.claim.sub', v_alice::text, TRUE);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_alice::text)::text, TRUE);
    PERFORM set_config('role', 'authenticated', TRUE);

    -- Carol: no shared group → denied
    BEGIN
        PERFORM public.get_user_simplified_inputs(v_carol);
        RAISE EXCEPTION 'Case A failed: Carol should be denied';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%not_authorized%' AND SQLERRM NOT LIKE '%42501%' THEN
            RAISE;
        END IF;
    END;

    -- Bob: shared group only (must not include Bob-only group with expense)
    v_payload := public.get_user_simplified_inputs(v_bob);
    SELECT COALESCE(array_agg(grp->>'groupId'), ARRAY[]::TEXT[])
      INTO v_group_ids
      FROM jsonb_array_elements(v_payload->'groups') grp;

    IF v_g_bob_only::text = ANY (v_group_ids) THEN
        RAISE EXCEPTION 'Case B failed: leaked Bob private group %', v_group_ids;
    END IF;
    -- Self-read must succeed (may return [] when groups have no balance activity)
    v_payload := public.get_user_simplified_inputs(v_alice);
    IF v_payload IS NULL OR v_payload->'groups' IS NULL THEN
        RAISE EXCEPTION 'Case C failed: Alice self-read returned null payload';
    END IF;

    -- #204 settle reminder rate limit (5 allowed, 6th fails)
    FOR i IN 1..5 LOOP
        PERFORM public.send_settle_reminder(v_g_shared, v_bob, 'please pay ' || i);
    END LOOP;
    BEGIN
        PERFORM public.send_settle_reminder(v_g_shared, v_bob, 'sixth');
        RAISE EXCEPTION 'Case D failed: 6th settle reminder should be rate limited';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%settle_reminder_rate_limit%' THEN
            RAISE;
        END IF;
    END;

    -- #205 support rate limit (trigger is ENABLE ALWAYS so it runs under replica role in CI)
    PERFORM set_config('role', 'anon', TRUE);
    FOR i IN 1..5 LOOP
        INSERT INTO public.support_messages (name, email, message)
        VALUES ('Spammer', 'spam@test.local', 'msg ' || i);
    END LOOP;
    BEGIN
        INSERT INTO public.support_messages (name, email, message)
        VALUES ('Spammer', 'spam@test.local', 'msg 6');
        RAISE EXCEPTION 'Case E failed: 6th support message should be rate limited';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%support_rate_limit%' THEN
            RAISE;
        END IF;
    END;

    RAISE NOTICE 'security_idor_rate_limits.test.sql — all cases passed';
END;
$outer$;

ROLLBACK;
