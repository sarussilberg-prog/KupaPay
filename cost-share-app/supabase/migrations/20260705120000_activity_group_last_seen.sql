-- 2026-07-05 — Per-group activity "last seen" watermark + unread-count RPCs.
--
-- Extends the global activity watermark (profiles.activity_last_seen_at,
-- added in 20260526105507_activity_events.sql) to per-group granularity so the
-- Groups list can show a per-group unread badge.
--
-- Apply order (per docs/SSOT/SUPABASE_ENVIRONMENTS.md):
--   1. dev   (drxfbicunusmipdgbgdk)  — first, via the `supabase` MCP.
--   2. prod  (jfqxjjjbpxbwwvoygahu)  — only after explicit user approval,
--                                       via the `supabase-prod` MCP.

BEGIN;

-- ============================================================================
-- 1. activity_group_last_seen — per (user, group) "I've seen up to" watermark.
--    Absent row means the group was never opened; unread then falls back to the
--    global profiles.activity_last_seen_at (anti-flood: no historic surge).
-- ============================================================================
CREATE TABLE IF NOT EXISTS activity_group_last_seen (
    user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, group_id)
);

-- RLS: users read only their own watermarks; only the SECURITY DEFINER RPC writes.
ALTER TABLE activity_group_last_seen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own group last seen" ON activity_group_last_seen;
CREATE POLICY "Users read own group last seen"
    ON activity_group_last_seen FOR SELECT
    USING (user_id = auth.uid());

-- ============================================================================
-- 2. mark_group_activity_seen — upsert seen_at = now() for the caller/group.
-- ============================================================================
CREATE OR REPLACE FUNCTION mark_group_activity_seen(p_group_id UUID) RETURNS void
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public
    AS $$
        INSERT INTO activity_group_last_seen (user_id, group_id, seen_at)
        VALUES (auth.uid(), p_group_id, NOW())
        ON CONFLICT (user_id, group_id)
        DO UPDATE SET seen_at = NOW();
    $$;

-- ============================================================================
-- 3. get_group_unread_counts — setof (group_id, unread) for the caller.
--    Threshold per group = coalesce(per-group seen_at, global watermark), so a
--    never-opened group inherits the global last-seen. Mirrors the global count:
--    actor_user_id <> auth.uid() excludes the user's own actions AND NULL-actor
--    events (NULL <> uuid → NULL, falsy in WHERE). Only rows with unread > 0.
-- ============================================================================
CREATE OR REPLACE FUNCTION get_group_unread_counts()
    RETURNS TABLE (group_id UUID, unread INTEGER)
    LANGUAGE sql
    SECURITY DEFINER STABLE
    SET search_path = public
    AS $$
        SELECT
            ae.group_id,
            COUNT(*)::integer AS unread
        FROM activity_events ae
        JOIN profiles p ON p.id = ae.user_id
        LEFT JOIN activity_group_last_seen gls
            ON gls.user_id = ae.user_id
           AND gls.group_id = ae.group_id
        WHERE ae.user_id = auth.uid()
          AND ae.group_id IS NOT NULL
          AND ae.actor_user_id <> auth.uid()
          AND ae.created_at > COALESCE(gls.seen_at, p.activity_last_seen_at)
        GROUP BY ae.group_id;
    $$;

REVOKE EXECUTE ON FUNCTION mark_group_activity_seen(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION get_group_unread_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION mark_group_activity_seen(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_group_unread_counts() TO authenticated;

COMMIT;
