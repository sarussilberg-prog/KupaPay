-- Regression: #450 — authenticated/anon cannot access invite_preview_rate_limits directly.

BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_rows INT;
BEGIN
    PERFORM public.test_set_authenticated('00000000-0000-0000-0000-000000a14501'::uuid);

    BEGIN
        SELECT COUNT(*) INTO v_rows FROM public.invite_preview_rate_limits;
        IF v_rows <> 0 THEN
            RAISE EXCEPTION 'Case A failed: authenticated should not read rate limit rows (got %)', v_rows;
        END IF;
    EXCEPTION
        WHEN insufficient_privilege THEN
            NULL;
        WHEN OTHERS THEN
            IF SQLERRM NOT LIKE '%42501%' AND SQLERRM NOT LIKE '%permission denied%' THEN
                RAISE;
            END IF;
    END;

    BEGIN
        INSERT INTO public.invite_preview_rate_limits (client_key, window_start, attempt_count)
        VALUES ('probe', NOW(), 1);
        RAISE EXCEPTION 'Case B failed: authenticated should not INSERT rate limit rows';
    EXCEPTION
        WHEN insufficient_privilege THEN
            NULL;
        WHEN check_violation THEN
            NULL;
        WHEN OTHERS THEN
            IF SQLERRM NOT LIKE '%42501%' AND SQLERRM NOT LIKE '%permission denied%' THEN
                RAISE;
            END IF;
    END;

    PERFORM public.enforce_invite_preview_rate_limit();

    RAISE NOTICE 'invite_preview_rate_limits_rls_450: passed';
END;
$outer$;

ROLLBACK;
