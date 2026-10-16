-- Dev/staging repair (#453): #444 used the same version prefix as #441.
-- If the smart-push file was recorded under 20261016350000, renumber the row to match
-- 20261016370000_smart_push_reminders_402.sql. Idempotent; safe on fresh CI databases.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM supabase_migrations.schema_migrations
        WHERE version = '20261016350000'
          AND name = 'smart_push_reminders_402'
    ) AND NOT EXISTS (
        SELECT 1
        FROM supabase_migrations.schema_migrations
        WHERE version = '20261016370000'
    ) THEN
        UPDATE supabase_migrations.schema_migrations
        SET version = '20261016370000'
        WHERE version = '20261016350000'
          AND name = 'smart_push_reminders_402';
    END IF;
END;
$$;
