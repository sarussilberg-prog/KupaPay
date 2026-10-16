-- Dev/staging repair (#453): renumber schema_migrations row for smart-push after #444/#441 collision.

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
