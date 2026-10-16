BEGIN;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'referral_rewards'
    ) THEN
        RAISE EXCEPTION 'referral_rewards table missing';
    END IF;
    PERFORM public.run_referral_reward_dispatch(1);
    RAISE NOTICE 'referral_program_400.test.sql — passed';
END $$;
ROLLBACK;
