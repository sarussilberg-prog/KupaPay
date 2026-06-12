-- Push notifications: one delivery row per activity_event (idempotency + retry + observability).

DO $$ BEGIN
    CREATE TYPE push_status AS ENUM ('pending','sent','failed','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS push_deliveries (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_event_id UUID NOT NULL REFERENCES activity_events(id) ON DELETE CASCADE,
    recipient_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status            push_status NOT NULL DEFAULT 'pending',
    attempts          INT NOT NULL DEFAULT 0,
    expo_ticket_ids   TEXT[],
    last_error        TEXT,
    sent_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (activity_event_id)
);

CREATE INDEX IF NOT EXISTS idx_push_deliveries_retry
    ON push_deliveries(status, created_at) WHERE status = 'failed';

-- No client access: only the Edge Function (service_role, bypasses RLS) writes here.
ALTER TABLE push_deliveries ENABLE ROW LEVEL SECURITY;
