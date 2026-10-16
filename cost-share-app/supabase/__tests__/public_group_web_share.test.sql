-- #398 — public web group balance RPC: opt-in, privacy, RLS, rate limit.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_a CONSTANT UUID := '00000000-0000-0000-0000-000000398101';
    v_b CONSTANT UUID := '00000000-0000-0000-0000-000000398102';
    v_g CONSTANT UUID := '00000000-0000-0000-0000-000000398110';
    v_exp CONSTANT UUID := '00000000-0000-0000-0000-000000398111';
    v_tok CONSTANT TEXT := 'pub398GrpTok1';
    v_payload JSON;
    v_enabled BOOLEAN;
    v_text TEXT;
    i INT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_a, 'pub398a@test.local'),
        (v_b, 'pub398b@test.local');
    INSERT INTO public.profiles (id, name, email, default_currency, is_active, invite_token) VALUES
        (v_a, 'Alice398', 'alice-secret@test.local', 'USD', TRUE, 'pub398Alice12'),
        (v_b, 'Bob398', 'bob-secret@test.local', 'USD', TRUE, 'pub398Bobbb12');
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token, public_web_share_enabled)
        VALUES (v_g, 'Pub398', 'USD', TRUE, v_a, v_tok, FALSE);
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_g, v_a, TRUE),
        (v_g, v_b, TRUE);

    INSERT INTO public.expenses (id, group_id, description, amount, currency, paid_by, created_by, expense_date, is_deleted)
        VALUES (v_exp, v_g, 'Dinner', 40, 'USD', v_a, v_a, CURRENT_DATE, FALSE);
    INSERT INTO public.expense_splits (expense_id, user_id, amount) VALUES
        (v_exp, v_a, 20),
        (v_exp, v_b, 20);

    SET LOCAL session_replication_role = origin;

    -- Disabled → same as unknown token (no oracle)
    v_payload := public.get_public_group_web_view(v_tok);
    IF v_payload->>'kind' IS DISTINCT FROM 'not_found' THEN
        RAISE EXCEPTION 'Case 1 failed: disabled share should be not_found, got %', v_payload;
    END IF;

    PERFORM public.test_set_authenticated(v_a);
    BEGIN
        UPDATE public.groups SET public_web_share_enabled = TRUE WHERE id = v_g;
        RAISE EXCEPTION 'Case 2 failed: direct PATCH of public_web_share_enabled should be denied';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%group_public_web_share_rpc_only%' AND SQLERRM NOT LIKE '%42501%' THEN
            RAISE;
        END IF;
    END;

    v_enabled := public.set_group_public_web_share(v_g, TRUE);
    IF v_enabled IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Case 3 failed: enable RPC should return true';
    END IF;

    PERFORM public.test_set_authenticated(NULL);

    v_payload := public.get_public_group_web_view(v_tok);
    IF v_payload->>'kind' IS DISTINCT FROM 'ok' THEN
        RAISE EXCEPTION 'Case 4 failed: enabled share should return ok, got %', v_payload;
    END IF;

    v_text := v_payload::text;
    IF v_text LIKE '%alice-secret%' OR v_text LIKE '%bob-secret%' OR v_text LIKE '%00000000%' THEN
        RAISE EXCEPTION 'Case 5 failed: payload leaked PII/UUIDs: %', v_text;
    END IF;

    IF (v_payload->'recentExpenses'->0->>'description') IS DISTINCT FROM 'Dinner' THEN
        RAISE EXCEPTION 'Case 6 failed: missing recent expense';
    END IF;

    -- RLS: anon cannot read expenses directly
    IF (SELECT COUNT(*) FROM public.expenses WHERE group_id = v_g) <> 0 THEN
        RAISE EXCEPTION 'Case 7 failed: anon should not SELECT expenses (got rows)';
    END IF;

    -- Revoke
    PERFORM public.test_set_authenticated(v_b);
    PERFORM public.set_group_public_web_share(v_g, FALSE);
    PERFORM public.test_set_authenticated(NULL);
    v_payload := public.get_public_group_web_view(v_tok);
    IF v_payload->>'kind' IS DISTINCT FROM 'not_found' THEN
        RAISE EXCEPTION 'Case 8 failed: revoked share should be not_found';
    END IF;

    -- Rate limit shares bucket with invite preview (#208)
    FOR i IN 1..61 LOOP
        PERFORM public.get_public_group_web_view('zzzzzzzzzzzz');
    END LOOP;
    BEGIN
        PERFORM public.get_public_group_web_view('zzzzzzzzzzzz');
        RAISE EXCEPTION 'Case 9 failed: 62nd public view should rate limit';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%invite_preview_rate_limit%' THEN
            RAISE;
        END IF;
    END;

    RAISE NOTICE 'public_group_web_share.test.sql — passed';
END;
$outer$;

ROLLBACK;
