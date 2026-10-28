-- Regression tests for get_public_group_balance_page (#398).
BEGIN;

SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_group  CONSTANT UUID := '00000000-0000-0000-0000-000000039801';
    v_alice  CONSTANT UUID := '00000000-0000-0000-0000-0000000398a1';
    v_bob    CONSTANT UUID := '00000000-0000-0000-0000-0000000398b1';
    v_invite CONSTANT TEXT := 'inviteTok398xxx';
    v_balance CONSTANT TEXT := 'balanceTok398xx';
    v_payload JSON;
    v_text TEXT;
    v_exp UUID;
    v_redeem JSON;
BEGIN
    INSERT INTO auth.users (id) VALUES (v_alice), (v_bob);
    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token)
    VALUES
        (v_alice, 'alice398@test.local', 'Alice', 'USD', 'en', TRUE, 'aliceTok398xx'),
        (v_bob,   'bob398@test.local',   'Bob',   'USD', 'en', TRUE, 'bobTok398xxxx');

    INSERT INTO public.groups (
        id, name, default_currency, created_by, is_active, group_type,
        invite_token, public_balance_token
    )
    VALUES (
        v_group, 'Public Web Group', 'USD', v_alice, TRUE, 'general',
        v_invite, v_balance
    );

    INSERT INTO public.group_members (group_id, user_id, is_active)
    VALUES (v_group, v_alice, TRUE), (v_group, v_bob, TRUE);

    INSERT INTO public.expenses (group_id, paid_by, amount, currency, description, expense_date, created_by, is_deleted)
    VALUES (v_group, v_alice, 40, 'USD', 'Dinner', CURRENT_DATE, v_alice, FALSE)
    RETURNING id INTO v_exp;

    INSERT INTO public.expense_splits (expense_id, user_id, amount)
    VALUES (v_exp, v_alice, 20), (v_exp, v_bob, 20);

    v_payload := public.get_public_group_balance_page(v_balance);
    IF (v_payload->>'ok')::BOOLEAN IS DISTINCT FROM FALSE THEN
        RAISE EXCEPTION 'Case 1 failed: sharing disabled by default';
    END IF;

    SET LOCAL session_replication_role = origin;
    PERFORM public.test_set_authenticated(v_alice);
    BEGIN
        UPDATE public.groups SET public_balance_sharing_enabled = TRUE WHERE id = v_group;
        RAISE EXCEPTION 'Case 1b failed: direct PATCH of sharing flag should be denied';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%group_public_balance_sharing_rpc_only%' AND SQLERRM NOT LIKE '%42501%' THEN
            RAISE;
        END IF;
    END;
    IF public.set_group_public_balance_sharing(v_group, TRUE) IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Case 1c failed: enable RPC should return true';
    END IF;
    PERFORM public.test_set_authenticated(NULL);

    v_payload := public.get_public_group_balance_page(v_balance);
    IF (v_payload->>'ok')::BOOLEAN IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Case 2 failed: expected ok=true after opt-in';
    END IF;

    v_payload := public.get_public_group_balance_page(v_invite);
    IF (v_payload->>'ok')::BOOLEAN IS DISTINCT FROM FALSE THEN
        RAISE EXCEPTION 'Case 3 failed: invite token must not expose balances';
    END IF;

    v_payload := public.get_public_group_balance_page(v_balance);
    IF v_payload->'group'->>'name' IS DISTINCT FROM 'Public Web Group' THEN
        RAISE EXCEPTION 'Case 4 failed: group name';
    END IF;

    v_text := v_payload::TEXT;
    IF v_text ILIKE '%email%' OR v_text ~ '[0-9a-f]{8}-[0-9a-f]{4}-' THEN
        RAISE EXCEPTION 'Case 5 failed: payload must not include email or UUIDs';
    END IF;

    IF json_array_length(v_payload->'recent_expenses') < 1 THEN
        RAISE EXCEPTION 'Case 6 failed: expected recent expenses';
    END IF;

    PERFORM set_config('request.jwt.claim.sub', v_bob::text, true);
    v_redeem := public.redeem_group_invite(v_balance);
    IF (v_redeem->>'ok')::boolean IS NOT FALSE
        OR v_redeem->>'error_code' IS DISTINCT FROM 'invite_not_found' THEN
        RAISE EXCEPTION 'Case 7 failed: balance token must not join a group, got %', v_redeem;
    END IF;

    v_payload := public.get_public_group_balance_page('short');
    IF (v_payload->>'ok')::BOOLEAN IS DISTINCT FROM FALSE THEN
        RAISE EXCEPTION 'Case 8 failed: short token must return ok=false';
    END IF;

    RAISE NOTICE 'public_group_balance_page.test.sql — all cases passed';
END;
$outer$;

ROLLBACK;
