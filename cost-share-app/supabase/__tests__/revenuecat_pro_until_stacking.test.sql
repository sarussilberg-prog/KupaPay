-- pro_until stacking: referral/promo time survives subscription EXPIRATION when longer.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_user   CONSTANT UUID := '00000000-0000-4000-8000-000000014301';
    v_sub    TIMESTAMPTZ := '2026-06-01T00:00:00Z';
    v_bonus  TIMESTAMPTZ := '2027-06-01T00:00:00Z';
    v_out    JSONB;
    v_pro    TIMESTAMPTZ;
BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_user, 'stack@test.local');
    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token, pro_until)
        VALUES (v_user, 'stack@test.local', 'Stack', 'USD', 'en', TRUE, 'tok_stack', v_bonus);

    SET LOCAL session_replication_role = origin;
    PERFORM set_config('role', 'service_role', TRUE);

    SELECT public.handle_revenuecat_webhook(
        'evt-stack-expire', v_user, 'EXPIRATION', 'kupapay_pro_monthly',
        v_sub, NULL, NULL, FALSE, FALSE, TRUE, FALSE, 5000
    ) INTO v_out;

    SELECT pro_until INTO v_pro FROM public.profiles WHERE id = v_user;
    IF v_pro IS DISTINCT FROM v_bonus THEN
        RAISE EXCEPTION 'Case 1 failed: expected bonus pro_until % after partial expiration, got %', v_bonus, v_pro;
    END IF;

    UPDATE public.profiles SET pro_until = v_sub WHERE id = v_user;
    SELECT public.handle_revenuecat_webhook(
        'evt-stack-expire-full', v_user, 'EXPIRATION', 'kupapay_pro_monthly',
        v_sub, NULL, NULL, FALSE, FALSE, TRUE, FALSE, 6000
    ) INTO v_out;
    SELECT pro_until INTO v_pro FROM public.profiles WHERE id = v_user;
    IF v_pro > '1971-01-01'::timestamptz THEN
        RAISE EXCEPTION 'Case 2 failed: expected cleared pro when only subscription time, got %', v_pro;
    END IF;

    RAISE NOTICE 'revenuecat_pro_until_stacking.test.sql — passed';
END;
$outer$;

ROLLBACK;
