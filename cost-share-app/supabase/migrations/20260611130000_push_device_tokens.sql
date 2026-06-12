-- Push notifications: per-device Expo push tokens.
-- See docs/superpowers/specs/2026-06-11-push-notifications-design.md

-- pg_net powers the activity_events -> send-push "database webhook" (Task 1.5).
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS device_tokens (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    token            TEXT NOT NULL UNIQUE,                -- Expo push token
    platform         TEXT NOT NULL CHECK (platform IN ('ios','android')),
    device_id        TEXT,
    app_version      TEXT,
    last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    disabled_at      TIMESTAMPTZ,                         -- set on logout / invalid receipt
    disabled_reason  TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user
    ON device_tokens(user_id) WHERE disabled_at IS NULL;

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own device tokens" ON device_tokens;
CREATE POLICY "Users read own device tokens" ON device_tokens
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own device tokens" ON device_tokens;
CREATE POLICY "Users insert own device tokens" ON device_tokens
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own device tokens" ON device_tokens;
CREATE POLICY "Users update own device tokens" ON device_tokens
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own device tokens" ON device_tokens;
CREATE POLICY "Users delete own device tokens" ON device_tokens
    FOR DELETE USING (auth.uid() = user_id);
