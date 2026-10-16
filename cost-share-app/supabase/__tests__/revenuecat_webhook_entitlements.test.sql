-- RevenueCat handle_revenuecat_webhook: entitlement + idempotency contract (Gate C / #141).
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_user   CONSTANT UUID := '00000000-0000-0000-0000-000000014101';
    v_group  CONSTANT UUID := '00000000-0000-0000-0000-000000014102';
    v_until  TIMESTAMPTZ := '2027-06-01T00:00:00Z';
    v_trial  TIMESTAMPTZ := '2026-04-01T00:00:00Z';
    v_out    JSONB;
    v_pro    TIMESTAMPTZ;
    v_cnt    INT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_user, 'rc141@test.local');
    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token, pro_until)
        VALUES (v_user, 'rc141@test.local', 'RC', 'USD', 'en', TRUE, 'tt_rc141', NULL);
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'RC Group', 'USD', TRUE, v_user, 'grp_rc141');

    SET LOCAL session_replication_role = origin;
    PERFORM set_config('role', 'service_role', TRUE);

    -- INITIAL_PURCHASE (trial-length pro window)
    SELECT public.handle_revenuecat_webhook(
        'evt-rc141-trial', v_user, 'INITIAL_PURCHASE', 'kupapay_pro_monthly',
        v_trial, NULL, NULL, FALSE, FALSE, FALSE
    ) INTO v_out;
    IF (v_out->>'duplicate')::BOOLEAN IS TRUE OR v_out->>'action' IS DISTINCT FROM 'individual' THEN
        RAISE EXCEPTION 'Case 1 failed: initial purchase action=%, out=%', v_out->>'action', v_out;
    END IF;
    SELECT pro_until INTO v_pro FROM public.profiles WHERE id = v_user;
    IF v_pro IS DISTINCT FROM v_trial THEN
        RAISE EXCEPTION 'Case 1 failed: pro_until expected % got %', v_trial, v_pro;
    END IF;

    -- RENEWAL extends pro
    SELECT public.handle_revenuecat_webhook(
        'evt-rc141-renew', v_user, 'RENEWAL', 'kupapay_pro_monthly',
        v_until, NULL, NULL, FALSE, FALSE, FALSE
    ) INTO v_out;
    SELECT pro_until INTO v_pro FROM public.profiles WHERE id = v_user;
    IF v_pro IS DISTINCT FROM v_until THEN
        RAISE EXCEPTION 'Case 2 failed: renewal pro_until expected % got %', v_until, v_pro;
    END IF;

    -- Idempotency: duplicate event id
    SELECT public.handle_revenuecat_webhook(
        'evt-rc141-renew', v_user, 'RENEWAL', 'kupapay_pro_monthly',
        v_until, NULL, NULL, FALSE, FALSE, FALSE
    ) INTO v_out;
    IF (v_out->>'duplicate')::BOOLEAN IS NOT TRUE THEN
        RAISE EXCEPTION 'Case 3 failed: expected duplicate=true, got %', v_out;
    END IF;

    -- CANCELLATION revoke (epoch sentinel from edge handler)
    SELECT public.handle_revenuecat_webhook(
        'evt-rc141-cancel', v_user, 'CANCELLATION', 'kupapay_pro_monthly',
        '1970-01-01T00:00:00Z', NULL, NULL, FALSE, FALSE, TRUE
    ) INTO v_out;
    IF v_out->>'action' IS DISTINCT FROM 'individual' THEN
        RAISE EXCEPTION 'Case 4 failed: cancellation action %', v_out->>'action';
    END IF;
    SELECT pro_until INTO v_pro FROM public.profiles WHERE id = v_user;
    IF v_pro IS DISTINCT FROM '1970-01-01T00:00:00+00:00'::timestamptz
       AND v_pro IS DISTINCT FROM '1970-01-01T00:00:00Z'::timestamptz THEN
        RAISE EXCEPTION 'Case 4 failed: pro_until after cancel got %', v_pro;
    END IF;

    -- EXPIRATION after re-grant
    UPDATE public.profiles SET pro_until = v_until WHERE id = v_user;
    SELECT public.handle_revenuecat_webhook(
        'evt-rc141-expire', v_user, 'EXPIRATION', 'kupapay_pro_monthly',
        '1970-01-01T00:00:00Z', NULL, NULL, FALSE, FALSE, TRUE
    ) INTO v_out;
    SELECT pro_until INTO v_pro FROM public.profiles WHERE id = v_user;
    IF v_pro > '1971-01-01'::timestamptz THEN
        RAISE EXCEPTION 'Case 5 failed: expiration should clear pro, got %', v_pro;
    END IF;

    SELECT COUNT(*) INTO v_cnt FROM public.revenuecat_webhook_events WHERE user_id = v_user;
    IF v_cnt < 4 THEN
        RAISE EXCEPTION 'Case 6 failed: expected webhook audit rows, got %', v_cnt;
    END IF;

    RAISE NOTICE 'revenuecat_webhook_entitlements.test.sql — passed';
END;
$outer$;

ROLLBACK;
