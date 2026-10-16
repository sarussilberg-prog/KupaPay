DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'notification_preferences'
          AND column_name = 'weekly_digest_push'
    ) THEN
        RAISE EXCEPTION 'weekly_digest_push missing';
    END IF;
    PERFORM public.run_weekly_summary_dispatch(1);
    RAISE NOTICE 'weekly_summary_405.test.sql — passed';
END $$;
