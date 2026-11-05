-- Referral reward: DB grant extends profiles.pro_until (has_pro source of truth).
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_referrer CONSTANT UUID := '00000000-0000-4000-8000-000000014201';
    v_referee  CONSTANT UUID := '00000000-0000-4000-8000-000000014202';
    v_reward   UUID;
    v_out      JSONB;
    v_pro      TIMESTAMPTZ;
    v_paid     TIMESTAMPTZ := '2027-01-01T00:00:00Z';
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_referrer, 'ref-referrer@test.local'),
        (v_referee, 'ref-referee@test.local');
    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token, pro_until)
    VALUES
        (v_referrer, 'ref-referrer@test.local', 'Referrer', 'USD', 'en', TRUE, 'tok_ref_r', v_paid),
        (v_referee, 'ref-referee@test.local', 'Referee', 'USD', 'en', TRUE, 'tok_ref_e', NULL);

    INSERT INTO public.referral_rewards (referrer_id, referee_id, status, qualified_at)
    VALUES (v_referrer, v_referee, 'qualified', NOW())
    RETURNING id INTO v_reward;

    SET LOCAL session_replication_role = origin;
    PERFORM set_config('role', 'service_role', TRUE);

    SELECT public.apply_referral_reward(v_reward) INTO v_out;
    IF (v_out->>'ok')::BOOLEAN IS NOT TRUE THEN
        RAISE EXCEPTION 'Case 1 failed: apply_referral_reward ok=false, out=%', v_out;
    END IF;

    SELECT pro_until INTO v_pro FROM public.profiles WHERE id = v_referrer;
    IF v_pro IS NULL OR v_pro <= v_paid THEN
        RAISE EXCEPTION 'Case 2 failed: expected stacked pro_until > paid until %, got %', v_paid, v_pro;
    END IF;

    IF public.has_pro(v_referrer, NULL) IS NOT TRUE THEN
        RAISE EXCEPTION 'Case 3 failed: has_pro should be true after referral grant';
    END IF;

    RAISE NOTICE 'referral_reward_grant.test.sql — passed';
END;
$outer$;

ROLLBACK;
