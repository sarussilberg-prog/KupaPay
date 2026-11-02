-- RevenueCat webhook hardening: trip-pass upsert, stale events, cancellation without expiration.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_user   CONSTANT UUID := '00000000-0000-4000-8000-000000014201';
    v_group  CONSTANT UUID := '00000000-0000-4000-8000-000000014202';
    v_until1 TIMESTAMPTZ := '2026-08-01T00:00:00Z';
    v_until2 TIMESTAMPTZ := '2026-10-01T00:00:00Z';
    v_pro    TIMESTAMPTZ := '2027-01-01T00:00:00Z';
    v_out    JSONB;
    v_pass   TIMESTAMPTZ;
BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_user, 'rc142@test.local');
    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token, pro_until)
        VALUES (v_user, 'rc142@test.local', 'RC142', 'USD', 'en', TRUE, 'tt_rc142', v_pro);
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'RC142 Group', 'USD', TRUE, v_user, 'grp_rc142');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES (v_group, v_user, TRUE);

    SET LOCAL session_replication_role = origin;
    PERFORM set_config('role', 'service_role', TRUE);

    -- M1: second trip pass for same group extends until (no unique violation)
    SELECT public.handle_revenuecat_webhook(
        'evt-rc142-tp1', v_user, 'NON_RENEWING_PURCHASE', 'kupapay_trip_pass',
        NULL, v_until1, v_group, TRUE, FALSE, FALSE, FALSE, 1000
    ) INTO v_out;
    IF v_out->>'action' IS DISTINCT FROM 'trip_pass' THEN
        RAISE EXCEPTION 'Case 1 failed: first trip pass %', v_out;
    END IF;

    SELECT public.handle_revenuecat_webhook(
        'evt-rc142-tp2', v_user, 'NON_RENEWING_PURCHASE', 'kupapay_trip_pass',
        NULL, v_until2, v_group, TRUE, FALSE, FALSE, FALSE, 2000
    ) INTO v_out;
    IF v_out->>'action' IS DISTINCT FROM 'trip_pass' THEN
        RAISE EXCEPTION 'Case 2 failed: second trip pass %', v_out;
    END IF;

    SELECT until INTO v_pass FROM public.group_passes WHERE group_id = v_group;
    IF v_pass IS DISTINCT FROM v_until2 THEN
        RAISE EXCEPTION 'Case 2 failed: until expected % got %', v_until2, v_pass;
    END IF;

    -- H2: cancellation without expiration does not clear pro_until
    SELECT public.handle_revenuecat_webhook(
        'evt-rc142-cancel-soft', v_user, 'CANCELLATION', 'kupapay_pro_monthly',
        NULL, NULL, NULL, FALSE, FALSE, FALSE, FALSE, 3000
    ) INTO v_out;
    IF v_out->>'action' IS DISTINCT FROM 'ignored' THEN
        RAISE EXCEPTION 'Case 3 failed: soft cancel should be ignored at RPC, got %', v_out;
    END IF;
    SELECT pro_until INTO v_pro FROM public.profiles WHERE id = v_user;
    IF v_pro IS DISTINCT FROM '2027-01-01T00:00:00Z'::timestamptz
       AND v_pro IS DISTINCT FROM '2027-01-01T00:00:00+00:00'::timestamptz THEN
        RAISE EXCEPTION 'Case 3 failed: pro_until changed to %', v_pro;
    END IF;

    -- Stale renewal must not extend pro after a newer revoke timestamp was applied
    UPDATE public.profiles SET revenuecat_last_event_ms = 5000 WHERE id = v_user;
    SELECT public.handle_revenuecat_webhook(
        'evt-rc142-stale-renew', v_user, 'RENEWAL', 'kupapay_pro_monthly',
        '2028-01-01T00:00:00Z', NULL, NULL, FALSE, FALSE, FALSE, FALSE, 4000
    ) INTO v_out;
    IF (v_out->>'stale')::BOOLEAN IS NOT TRUE THEN
        RAISE EXCEPTION 'Case 4 failed: expected stale renewal, got %', v_out;
    END IF;

    -- Trip pass refund revoke
    SELECT public.handle_revenuecat_webhook(
        'evt-rc142-tp-refund', v_user, 'CANCELLATION', 'kupapay_trip_pass',
        NULL, NULL, v_group, FALSE, FALSE, FALSE, TRUE, 6000
    ) INTO v_out;
    SELECT until INTO v_pass FROM public.group_passes WHERE group_id = v_group;
    IF v_pass > NOW() + INTERVAL '1 minute' THEN
        RAISE EXCEPTION 'Case 5 failed: trip pass should be revoked, until=%', v_pass;
    END IF;

    RAISE NOTICE 'revenuecat_webhook_hardening.test.sql — passed';
END;
$outer$;

ROLLBACK;
