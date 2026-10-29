-- Ambassador program (#420): applications, manual approve, referral attribution.

BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_admin UUID := '00000000-0000-0000-0000-000000b42001'::uuid;
    v_creator UUID := '00000000-0000-0000-0000-000000b42002'::uuid;
    v_referee UUID := '00000000-0000-0000-0000-000000b42003'::uuid;
    v_app_id UUID;
    v_result JSONB;
    v_code TEXT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_admin, 'amb-admin@test.local'),
        (v_creator, 'amb-creator@test.local'),
        (v_referee, 'amb-referee@test.local');

    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token) VALUES
        (v_admin, 'amb-admin@test.local', 'Admin', 'USD', 'en', TRUE, 'tt_amb_admin'),
        (v_creator, 'amb-creator@test.local', 'Creator', 'USD', 'en', TRUE, 'tt_amb_creator'),
        (v_referee, 'amb-referee@test.local', 'Referee', 'USD', 'en', TRUE, 'tt_amb_referee');

    INSERT INTO public.app_admins (user_id) VALUES (v_admin) ON CONFLICT DO NOTHING;

    SET LOCAL session_replication_role = origin;

    PERFORM public.test_set_authenticated(v_creator);
    v_result := public.submit_ambassador_application(
        'travel_creator',
        'https://example.com/creator',
        'I run a student travel community with regular group trips.',
        TRUE
    );
    IF (v_result->>'ok')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'Case 1 failed: submit application';
    END IF;
    v_app_id := (v_result->>'application_id')::uuid;

    BEGIN
        PERFORM public.submit_ambassador_application(
            'travel_creator', 'https://example.com/x', 'Duplicate pending should fail.', TRUE
        );
        RAISE EXCEPTION 'Case 2 failed: duplicate pending should raise';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM NOT LIKE '%application_pending%' THEN
                RAISE;
            END IF;
    END;

    PERFORM public.test_set_authenticated(v_referee);
    BEGIN
        PERFORM public.admin_approve_ambassador_application(v_app_id, 90);
        RAISE EXCEPTION 'Case 3 failed: non-admin must not approve';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM NOT LIKE '%not_authorized%' AND SQLERRM NOT LIKE '%42501%' THEN
                RAISE;
            END IF;
    END;

    PERFORM public.test_set_authenticated(v_admin);
    v_result := public.admin_approve_ambassador_application(v_app_id, 90);
    v_code := v_result->>'referral_code';
    IF v_code IS NULL OR v_code NOT LIKE 'AMB-%' THEN
        RAISE EXCEPTION 'Case 4 failed: expected referral code on approve';
    END IF;

    IF (v_result->>'pro_until') IS NULL OR (v_result->>'pro_until')::timestamptz <= NOW() THEN
        RAISE EXCEPTION 'Case 5 failed: pro_until should be extended in approve result';
    END IF;

    PERFORM public.test_set_authenticated(v_referee);
    v_result := public.attribute_ambassador_referral(v_code);
    IF (v_result->>'ok')::boolean IS NOT TRUE OR (v_result->>'already_attributed')::boolean IS TRUE THEN
        RAISE EXCEPTION 'Case 6 failed: first attribution';
    END IF;

    v_result := public.attribute_ambassador_referral(v_code);
    IF (v_result->>'already_attributed')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'Case 7 failed: second attribution should be idempotent';
    END IF;

    PERFORM public.test_set_authenticated(v_creator);
    BEGIN
        PERFORM public.attribute_ambassador_referral(v_code);
        RAISE EXCEPTION 'Case 8 failed: self-refer should fail';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM NOT LIKE '%cannot_self_refer%' THEN
                RAISE;
            END IF;
    END;

    PERFORM public.test_set_authenticated(v_creator);
    v_result := public.get_my_ambassador_referral_stats();
    IF (v_result->>'referral_count')::int <> 1 THEN
        RAISE EXCEPTION 'Case 9 failed: ambassador referral count';
    END IF;

    PERFORM public.test_set_authenticated(v_referee);
    IF EXISTS (
        SELECT 1 FROM public.ambassador_applications WHERE user_id = v_creator
    ) THEN
        RAISE EXCEPTION 'Case 10 failed: cross-user read on ambassador_applications';
    END IF;
END;
$outer$;

ROLLBACK;

DO $notice$
BEGIN
    RAISE NOTICE 'ambassador_program_420.test.sql — passed';
END;
$notice$;
