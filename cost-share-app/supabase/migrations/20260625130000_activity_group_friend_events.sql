-- Expand activity coverage: group_created / group_deleted / group_note_changed,
-- friend-request rejection (both sides), and the unread-note dot plumbing.

-- 1. Widen the kind CHECK constraint.
ALTER TABLE activity_events DROP CONSTRAINT IF EXISTS activity_events_kind_check;
ALTER TABLE activity_events ADD CONSTRAINT activity_events_kind_check CHECK (kind IN (
    'expense_added',
    'settlement_added',
    'message_posted',
    'friend_request_received',
    'group_added',
    'group_member_joined',
    'group_removed',
    'group_created',
    'group_deleted',
    'group_note_changed'
));

-- 2. Unread-note columns.
ALTER TABLE groups         ADD COLUMN IF NOT EXISTS note_updated_at TIMESTAMPTZ;
ALTER TABLE group_members  ADD COLUMN IF NOT EXISTS note_seen_at    TIMESTAMPTZ;

-- 3. Stamp note_updated_at whenever the note text actually changes.
CREATE OR REPLACE FUNCTION stamp_group_note_updated_at() RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    BEGIN
        IF NEW.note IS DISTINCT FROM OLD.note THEN
            NEW.note_updated_at := NOW();
        END IF;
        RETURN NEW;
    END;
    $$;

DROP TRIGGER IF EXISTS trg_stamp_group_note_updated_at ON groups;
CREATE TRIGGER trg_stamp_group_note_updated_at
    BEFORE UPDATE OF note ON groups
    FOR EACH ROW EXECUTE FUNCTION stamp_group_note_updated_at();

-- 4. Group lifecycle activity events: created / deleted / note_changed.
CREATE OR REPLACE FUNCTION emit_group_activity_events() RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
        v_actor UUID := auth.uid();
    BEGIN
        -- group_created: one row for the creator (self-action → never pushes).
        IF TG_OP = 'INSERT' AND NEW.is_active = true THEN
            INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata, created_at)
            VALUES (
                NEW.created_by, 'group_created', NEW.id, NEW.id, NEW.created_by,
                jsonb_build_object('group_name', NEW.name), NOW()
            )
            ON CONFLICT (user_id, kind, ref_id) DO NOTHING;
            RETURN NEW;
        END IF;

        IF TG_OP = 'UPDATE' THEN
            -- group_deleted: soft delete → fan out to every active member.
            IF OLD.is_active = true AND NEW.is_active = false THEN
                INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata, created_at)
                SELECT gm.user_id, 'group_deleted', NEW.id, gen_random_uuid(), v_actor,
                       jsonb_build_object('group_name', NEW.name), NOW()
                FROM group_members gm
                WHERE gm.group_id = NEW.id AND gm.is_active = true
                ON CONFLICT (user_id, kind, ref_id) DO NOTHING;
                RETURN NEW;
            END IF;

            -- group_note_changed: fan out to every active member; mark editor read.
            IF NEW.is_active = true AND NEW.note IS DISTINCT FROM OLD.note THEN
                INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata, created_at)
                SELECT gm.user_id, 'group_note_changed', NEW.id, gen_random_uuid(), v_actor,
                       jsonb_build_object('group_name', NEW.name), NOW()
                FROM group_members gm
                WHERE gm.group_id = NEW.id AND gm.is_active = true
                ON CONFLICT (user_id, kind, ref_id) DO NOTHING;

                -- The editor just wrote it: never show them their own dot.
                IF v_actor IS NOT NULL THEN
                    UPDATE group_members SET note_seen_at = NOW()
                    WHERE group_id = NEW.id AND user_id = v_actor;
                END IF;
            END IF;
        END IF;

        RETURN NEW;
    END;
    $$;

DROP TRIGGER IF EXISTS trg_group_activity_events ON groups;
CREATE TRIGGER trg_group_activity_events
    AFTER INSERT OR UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION emit_group_activity_events();

-- 5. Friend-request activity: add a sender-side row on rejection, and carry
--    responder_user_id so the feed can render perspective ("You declined" vs
--    "{name} declined your request"). Mirrors the existing 'accepted' flow.
CREATE OR REPLACE FUNCTION emit_friend_request_activity_events() RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
        IF TG_OP = 'INSERT' THEN
            INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata, created_at)
            VALUES (
                NEW.to_user_id, 'friend_request_received', NULL, NEW.id, NEW.from_user_id,
                jsonb_build_object('status', NEW.status, 'responded_at', NEW.responded_at),
                NEW.created_at
            )
            ON CONFLICT (user_id, kind, ref_id) DO NOTHING;
        END IF;

        IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
            -- Update recipient's existing row in place (does not bump created_at,
            -- so the push update-webhook stays quiet for the responder).
            UPDATE activity_events
            SET metadata = jsonb_build_object(
                'status', NEW.status,
                'responded_at', NEW.responded_at,
                'responder_user_id', NEW.to_user_id
            )
            WHERE kind = 'friend_request_received' AND ref_id = NEW.id;

            -- Sender-side row on acceptance OR rejection so the sender sees the outcome.
            IF NEW.status IN ('accepted', 'rejected') THEN
                INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata, created_at)
                VALUES (
                    NEW.from_user_id, 'friend_request_received', NULL, NEW.id, NEW.to_user_id,
                    jsonb_build_object(
                        'status', NEW.status,
                        'responded_at', NEW.responded_at,
                        'responder_user_id', NEW.to_user_id
                    ),
                    COALESCE(NEW.responded_at, NOW())
                )
                ON CONFLICT (user_id, kind, ref_id) DO NOTHING;
            END IF;
        END IF;
        RETURN NEW;
    END;
    $$;

-- 6. Mark the caller's note as seen (clears the unread dot).
CREATE OR REPLACE FUNCTION mark_group_note_seen(p_group_id uuid) RETURNS void
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public
    AS $$
        UPDATE group_members SET note_seen_at = NOW()
        WHERE group_id = p_group_id AND user_id = auth.uid();
    $$;

REVOKE EXECUTE ON FUNCTION mark_group_note_seen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION mark_group_note_seen(uuid) TO authenticated;
