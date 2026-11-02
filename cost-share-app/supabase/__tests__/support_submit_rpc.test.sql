-- submit_support_message RPC: validation, honeypot, rate limit via existing trigger.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    i INT;
    v_out JSONB;
BEGIN
    PERFORM set_config('role', 'anon', TRUE);

    SELECT public.submit_support_message('A', 'a@test.local', 'hello') INTO v_out;
    IF (v_out->>'ok')::BOOLEAN IS NOT TRUE THEN
        RAISE EXCEPTION 'Case 1 failed: expected ok json, got %', v_out;
    END IF;

    BEGIN
        PERFORM public.submit_support_message('', 'a@test.local', 'x');
        RAISE EXCEPTION 'Case 2 failed: empty name should fail';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%support_invalid_payload%' THEN
            RAISE;
        END IF;
    END;

    PERFORM public.submit_support_message('Bot', 'bot@test.local', 'ignore me', 'http://spam.example');

    FOR i IN 1..5 LOOP
        PERFORM public.submit_support_message('Spammer', 'rpc-spam@test.local', 'msg ' || i);
    END LOOP;

    BEGIN
        PERFORM public.submit_support_message('Spammer', 'rpc-spam@test.local', 'msg 6');
        RAISE EXCEPTION 'Case 4 failed: 6th message should hit rate limit';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%support_rate_limit%' THEN
            RAISE;
        END IF;
    END;

    RAISE NOTICE 'support_submit_rpc.test.sql — passed';
END;
$outer$;

ROLLBACK;
