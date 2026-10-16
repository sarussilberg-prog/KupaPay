-- Dev repair (#460/#394): duplicate schema_migrations.version 20261016432000 (demo group + email lifecycle).

DO $$
BEGIN
    IF to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1 FROM supabase_migrations.schema_migrations
        WHERE version = '20261016432000'
          AND name = 'email_lifecycle_404'
    ) AND NOT EXISTS (
        SELECT 1 FROM supabase_migrations.schema_migrations
        WHERE version = '20261016432500'
    ) THEN
        UPDATE supabase_migrations.schema_migrations
        SET version = '20261016432500'
        WHERE version = '20261016432000'
          AND name = 'email_lifecycle_404';
    END IF;
END;
$$;
