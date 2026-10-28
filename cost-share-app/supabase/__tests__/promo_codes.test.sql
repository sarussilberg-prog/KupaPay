-- Promo codes: admin RPCs, redeem, rate limit, RLS deny direct access.

BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_admin UUID := '00000000-0000-0000-0000-000000a14502'::uuid;
    v_alice UUID := '00000000-0000-0000-0000-000000a14503'::uuid;
    v_bob UUID := '00000000-0000-0000-0000-000000a14504'::uuid;
    v_carol UUID := '00000000-0000-0000-0000-000000a14505'::uuid;
    v_code_id UUID;
    v_result JSONB;
    v_until TIMESTAMPTZ;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_admin, 'promo-admin@test.local'),
        (v_alice, 'promo-alice@test.local'),
        (v_bob, 'promo-bob@test.local'),
        (v_carol, 'promo-carol@test.local');

    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token) VALUES
        (v_admin, 'promo-admin@test.local', 'Admin', 'USD', 'en', TRUE, 'tt_promo_admin'),
        (v_alice, 'promo-alice@test.local', 'Alice', 'USD', 'en', TRUE, 'tt_promo_alice'),
        (v_bob, 'promo-bob@test.local', 'Bob', 'USD', 'en', TRUE, 'tt_promo_bob'),
        (v_carol, 'promo-carol@test.local', 'Carol', 'USD', 'en', TRUE, 'tt_promo_carol');

    INSERT INTO public.app_admins (user_id) VALUES (v_admin) ON CONFLICT DO NOTHING;

    SET LOCAL session_replication_role = origin;

    PERFORM public.test_set_authenticated(v_alice);
    BEGIN
        PERFORM public.admin_list_promo_codes();
        RAISE EXCEPTION 'Case 1 failed: non-admin must not list promo codes';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM NOT LIKE '%not_authorized%' AND SQLERRM NOT LIKE '%42501%' THEN
                RAISE;
            END IF;
    END;

    PERFORM public.test_set_authenticated(v_admin);
    v_code_id := public.admin_create_promo_code('TEST-PROMO-01', 14, 2, NOW() + INTERVAL '30 days');

    IF v_code_id IS NULL THEN
        RAISE EXCEPTION 'Case 2 failed: admin_create_promo_code returned null';
    END IF;

    PERFORM public.test_set_authenticated(v_alice);
    v_result := public.redeem_promo_code('test-promo-01');
    IF (v_result->>'ok')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'Case 3 failed: redeem should succeed, got %', v_result;
    END IF;

    SELECT pro_until INTO v_until FROM public.profiles WHERE id = v_alice;
    IF v_until IS NULL OR v_until <= NOW() THEN
        RAISE EXCEPTION 'Case 4 failed: pro_until should be extended';
    END IF;

    BEGIN
        PERFORM public.redeem_promo_code('TEST-PROMO-01');
        RAISE EXCEPTION 'Case 5 failed: double redeem should fail';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM NOT LIKE '%promo_already_redeemed%' THEN
                RAISE;
            END IF;
    END;

    PERFORM public.test_set_authenticated(v_admin);
    PERFORM public.admin_set_promo_code_active(v_code_id, FALSE);

    PERFORM public.test_set_authenticated(v_bob);
    BEGIN
        PERFORM public.redeem_promo_code('TEST-PROMO-01');
        RAISE EXCEPTION 'Case 6 failed: inactive code should not redeem';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM NOT LIKE '%promo_inactive%' THEN
                RAISE;
            END IF;
    END;

    PERFORM public.test_set_authenticated(v_alice);
    BEGIN
        SELECT COUNT(*) FROM public.promo_codes;
        RAISE EXCEPTION 'Case 7 failed: authenticated should not SELECT promo_codes';
    EXCEPTION
        WHEN insufficient_privilege THEN NULL;
        WHEN OTHERS THEN
            IF SQLERRM NOT LIKE '%42501%' AND SQLERRM NOT LIKE '%permission denied%' THEN
                RAISE;
            END IF;
    END;

    PERFORM public.test_set_authenticated(v_admin);
    v_code_id := public.admin_create_promo_code('EXPIRED-PROMO', 7, NULL, NOW() - INTERVAL '1 day');
    PERFORM public.test_set_authenticated(v_bob);
    BEGIN
        PERFORM public.redeem_promo_code('EXPIRED-PROMO');
        RAISE EXCEPTION 'Case 8 failed: expired code should not redeem';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM NOT LIKE '%promo_expired%' THEN
                RAISE;
            END IF;
    END;

    PERFORM public.test_set_authenticated(v_carol);
    FOR i IN 1..15 LOOP
        BEGIN
            PERFORM public.redeem_promo_code('NOT-A-REAL-CODE');
            RAISE EXCEPTION 'Case 9a failed: invalid code should not succeed on attempt %', i;
        EXCEPTION
            WHEN OTHERS THEN
                IF SQLERRM NOT LIKE '%promo_invalid%' AND SQLERRM NOT LIKE '%P0002%' THEN
                    RAISE;
                END IF;
        END;
    END LOOP;
    BEGIN
        PERFORM public.redeem_promo_code('NOT-A-REAL-CODE');
        RAISE EXCEPTION 'Case 9b failed: 16th attempt should hit rate limit';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM NOT LIKE '%promo_rate_limit_exceeded%' THEN
                RAISE;
            END IF;
    END;

    PERFORM public.test_set_authenticated(v_alice);
    BEGIN
        SELECT COUNT(*) FROM public.promo_redemptions;
        RAISE EXCEPTION 'Case 10 failed: authenticated should not SELECT promo_redemptions';
    EXCEPTION
        WHEN insufficient_privilege THEN NULL;
        WHEN OTHERS THEN
            IF SQLERRM NOT LIKE '%42501%' AND SQLERRM NOT LIKE '%permission denied%' THEN
                RAISE;
            END IF;
    END;

    RAISE NOTICE 'promo_codes tests passed';
END;
$outer$;

ROLLBACK;
