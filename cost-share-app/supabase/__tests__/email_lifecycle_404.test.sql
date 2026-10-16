-- #404 — email lifecycle RPC smoke (structure + unsubscribe token).

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'notification_preferences'
          AND column_name = 'lifecycle_email_enabled'
    ) THEN
        RAISE EXCEPTION 'lifecycle_email_enabled column missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles'
          AND column_name = 'email_unsubscribe_token'
    ) THEN
        RAISE EXCEPTION 'email_unsubscribe_token column missing';
    END IF;

    PERFORM public.run_email_lifecycle_dispatch(1);
    RAISE NOTICE 'email_lifecycle_404.test.sql — passed';
END $$;
