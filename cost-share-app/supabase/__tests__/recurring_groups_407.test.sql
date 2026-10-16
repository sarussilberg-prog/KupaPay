DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'groups'
          AND column_name = 'monthly_bills_mode'
    ) THEN
        RAISE EXCEPTION 'monthly_bills_mode missing';
    END IF;
    RAISE NOTICE 'recurring_groups_407.test.sql — passed';
END $$;
