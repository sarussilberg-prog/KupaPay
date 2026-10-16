-- #402 smart push reminders schema smoke test
DO $$
BEGIN
    IF to_regprocedure('public.run_retention_unsettled_nudges(integer)') IS NULL THEN
        RAISE EXCEPTION 'run_retention_unsettled_nudges missing';
    END IF;
    IF to_regprocedure('public.list_deferred_push_deliveries(integer)') IS NULL THEN
        RAISE EXCEPTION 'list_deferred_push_deliveries missing';
    END IF;
    IF to_regprocedure('public.count_push_sent_last_24h(uuid)') IS NULL THEN
        RAISE EXCEPTION 'count_push_sent_last_24h missing';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'notification_preferences'
          AND column_name = 'reminders_push'
    ) THEN
        RAISE EXCEPTION 'notification_preferences.reminders_push missing';
    END IF;
END $$;
