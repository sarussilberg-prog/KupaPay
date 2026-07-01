-- Enable realtime for consolidation_batches so GroupDetailScreen's
-- useGroupConsolidationBatchesRealtime hook receives live INSERT/UPDATE events.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'consolidation_batches'
    ) THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.consolidation_batches';
    END IF;
END $$;
