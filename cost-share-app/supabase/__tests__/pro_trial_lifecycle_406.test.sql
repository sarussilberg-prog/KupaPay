DO $$
BEGIN
    PERFORM public.run_pro_trial_lifecycle_dispatch(1);
    RAISE NOTICE 'pro_trial_lifecycle_406.test.sql — passed';
END $$;
