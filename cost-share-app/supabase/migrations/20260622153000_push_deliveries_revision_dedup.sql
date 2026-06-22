-- 2026-06-22 — Let push notifications re-fire when an activity event is edited or deleted.
--
-- Problem: editing/deleting an expense, settlement, or message reuses the SAME
-- activity_events row (the emit_* triggers bump created_at to re-fire the push
-- webhook). But push_deliveries.UNIQUE(activity_event_id) + the send-push edge
-- function's recordPending() treated that re-fire as a duplicate of the original
-- "added" delivery row and dropped it — so edits/deletes never pushed.
--
-- Fix: record the event revision (activity_events.created_at, which bumps on every
-- edit/delete) on the delivery row. The edge function compares it to the incoming
-- event's created_at to tell a genuine new revision (edit/delete → re-send) from a
-- duplicate trigger delivery for the same revision (→ drop). One row per
-- activity_event is preserved; the row is reset to 'pending' for each new revision,
-- so the retry/observability RPCs that key on activity_event_id are unaffected.

BEGIN;

ALTER TABLE public.push_deliveries
    ADD COLUMN IF NOT EXISTS event_created_at TIMESTAMPTZ;

-- Backfill existing rows from the current event timestamp. Any later edit/delete
-- will be strictly newer, so historical rows won't spuriously re-send.
UPDATE public.push_deliveries pd
   SET event_created_at = ae.created_at
  FROM public.activity_events ae
 WHERE ae.id = pd.activity_event_id
   AND pd.event_created_at IS NULL;

-- Safety net for any row whose event is somehow absent (the FK should prevent this).
UPDATE public.push_deliveries
   SET event_created_at = created_at
 WHERE event_created_at IS NULL;

ALTER TABLE public.push_deliveries
    ALTER COLUMN event_created_at SET DEFAULT NOW();
ALTER TABLE public.push_deliveries
    ALTER COLUMN event_created_at SET NOT NULL;

COMMIT;
