-- Push notifications: per-user, per-category push toggles.
-- Missing row == all-on defaults (handled by COALESCE in send-push + RPC upsert).

CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id          UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    push_enabled     BOOLEAN NOT NULL DEFAULT TRUE,   -- master switch
    expenses_push    BOOLEAN NOT NULL DEFAULT TRUE,
    settlements_push BOOLEAN NOT NULL DEFAULT TRUE,
    messages_push    BOOLEAN NOT NULL DEFAULT TRUE,
    friends_push     BOOLEAN NOT NULL DEFAULT TRUE,
    groups_push      BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notification prefs" ON notification_preferences;
CREATE POLICY "Users read own notification prefs" ON notification_preferences
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own notification prefs" ON notification_preferences;
CREATE POLICY "Users insert own notification prefs" ON notification_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own notification prefs" ON notification_preferences;
CREATE POLICY "Users update own notification prefs" ON notification_preferences
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
