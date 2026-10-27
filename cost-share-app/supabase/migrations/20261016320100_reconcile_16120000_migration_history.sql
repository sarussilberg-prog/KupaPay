-- Reconcile schema_migrations after repo aligns 20261016120000 with prod (pro_trial_reminder_cron).
-- Production: no-op (120000 is already pro_trial_reminder_cron; archive SQL runs via 20261016320000).
-- Development: remove mistaken archive_group row at 120000; fold 20261016120500 pro_trial into 120000.

DO $$
BEGIN
    IF to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1 FROM supabase_migrations.schema_migrations
        WHERE version = '20261016120000' AND name = 'archive_group_rpc_result'
    ) THEN
        DELETE FROM supabase_migrations.schema_migrations
        WHERE version = '20261016120000' AND name = 'archive_group_rpc_result';
    END IF;

    IF EXISTS (
        SELECT 1 FROM supabase_migrations.schema_migrations
        WHERE version = '20261016120500' AND name = 'pro_trial_reminder_cron'
    ) AND NOT EXISTS (
        SELECT 1 FROM supabase_migrations.schema_migrations
        WHERE version = '20261016120000' AND name = 'pro_trial_reminder_cron'
    ) THEN
        UPDATE supabase_migrations.schema_migrations
        SET version = '20261016120000'
        WHERE version = '20261016120500' AND name = 'pro_trial_reminder_cron';
    END IF;
END;
$$;
