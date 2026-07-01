-- monetization_events: tracks ad gate funnel + remind events for analytics
CREATE TABLE IF NOT EXISTS monetization_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    event_type  TEXT NOT NULL CHECK (event_type IN (
                    'ad_gate_shown',
                    'ad_gate_watch_tapped',
                    'ad_gate_watch_completed',
                    'ad_gate_pro_tapped',
                    'remind_sent'
                )),
    platform    TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users can insert their own rows; nobody reads others
ALTER TABLE monetization_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own monetization events"
    ON monetization_events FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Admins read all
CREATE POLICY "admins read monetization events"
    ON monetization_events FOR SELECT
    TO authenticated
    USING (is_app_admin());
