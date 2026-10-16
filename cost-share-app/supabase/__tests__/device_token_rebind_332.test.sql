-- #332 — register_device_token must not steal an active token from another user.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_a      CONSTANT UUID := '00000000-0000-0000-0000-000000033201';
    v_b      CONSTANT UUID := '00000000-0000-0000-0000-000000033202';
    v_tok    CONSTANT TEXT := 'ExponentPushToken[test-332-hijack]';
    v_caught BOOLEAN;
    v_owner  UUID;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_a, 'tok332-a@test.local'),
        (v_b, 'tok332-b@test.local');

    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token) VALUES
        (v_a, 'tok332-a@test.local', 'A', 'USD', 'en', TRUE, 'tt_tok332_a'),
        (v_b, 'tok332-b@test.local', 'B', 'USD', 'en', TRUE, 'tt_tok332_b');

    PERFORM public.test_set_authenticated(v_a);
    PERFORM public.register_device_token(v_tok, 'ios');

    PERFORM public.test_set_authenticated(v_b);
    v_caught := FALSE;
    BEGIN
        PERFORM public.register_device_token(v_tok, 'android');
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM = 'token_bound_to_other_user' THEN
            v_caught := TRUE;
        ELSE
            RAISE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Case 1 failed: must not rebind active token owned by another user';
    END IF;

    SELECT user_id INTO v_owner FROM public.device_tokens WHERE token = v_tok;
    IF v_owner <> v_a THEN
        RAISE EXCEPTION 'Case 2 failed: token owner should remain A (got %)', v_owner;
    END IF;

    UPDATE public.device_tokens
        SET disabled_at = NOW(), disabled_reason = 'test'
        WHERE token = v_tok;

    PERFORM public.register_device_token(v_tok, 'android');
    SELECT user_id INTO v_owner FROM public.device_tokens WHERE token = v_tok;
    IF v_owner <> v_b THEN
        RAISE EXCEPTION 'Case 3 failed: disabled token may rebind to B (got %)', v_owner;
    END IF;

    RAISE NOTICE 'device_token_rebind_332.test.sql — passed';
END;
$outer$;

ROLLBACK;
