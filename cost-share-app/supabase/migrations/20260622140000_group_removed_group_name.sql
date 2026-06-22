-- Carry the group name on `group_removed` activity events.
--
-- Bug: the "You left / X removed you from {group}" activity copy interpolates a
-- group name the client resolves from its own active-groups cache. But a removed
-- member no longer has that group in their cache (and RLS blocks them from
-- re-reading it), so {group} rendered blank — e.g. "You left " with nothing after.
--
-- Fix: the SECURITY DEFINER membership trigger already has unrestricted read on
-- `groups`, so it now snapshots the group name into the event metadata
-- (`group_name`) at removal time. The client falls back to metadata.group_name
-- when the live cache misses. This survives both removal and group deletion.
--
-- Supersedes 20260622120000_group_removed_actor.sql (actor capture is retained
-- here so this migration is self-contained regardless of apply order).
-- Only the trigger function changes; the trigger binding is untouched.
-- Idempotent — re-running just rewrites the function. Forward-only: rows written
-- before this migration keep their old metadata and render without a group name.

CREATE OR REPLACE FUNCTION emit_group_membership_activity_events() RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
        v_group_created_by UUID;
        v_group_name       TEXT;
        v_is_join          BOOLEAN := false;
        v_is_leave         BOOLEAN := false;
        v_is_rejoin        BOOLEAN := false;
    BEGIN
        IF TG_OP = 'INSERT' AND NEW.is_active = true THEN
            v_is_join := true;
        ELSIF TG_OP = 'UPDATE' AND OLD.is_active = false AND NEW.is_active = true THEN
            v_is_join := true;
            v_is_rejoin := true;
        ELSIF TG_OP = 'UPDATE' AND OLD.is_active = true AND NEW.is_active = false THEN
            v_is_leave := true;
        END IF;

        IF v_is_join THEN
            SELECT created_by INTO v_group_created_by FROM groups WHERE id = NEW.group_id;

            -- Founder's own initial INSERT: emit nothing.
            IF TG_OP = 'INSERT' AND NEW.user_id = v_group_created_by THEN
                RETURN NEW;
            END IF;

            IF v_is_rejoin THEN
                -- Clear prior rows so UNIQUE(user_id, kind, ref_id) doesn't suppress new events.
                DELETE FROM activity_events
                WHERE ref_id = NEW.id
                  AND kind IN ('group_added', 'group_member_joined', 'group_removed');
            END IF;

            -- One row for the new member.
            INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata, created_at)
            VALUES (
                NEW.user_id,
                'group_added',
                NEW.group_id,
                NEW.id,
                NEW.added_by,
                jsonb_build_object('joined_at', NEW.joined_at),
                COALESCE(NEW.joined_at, NOW())
            )
            ON CONFLICT (user_id, kind, ref_id) DO NOTHING;

            -- One row per OTHER active member.
            INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata, created_at)
            SELECT
                gm.user_id,
                'group_member_joined',
                NEW.group_id,
                NEW.id,
                NEW.user_id,
                jsonb_build_object('new_member_user_id', NEW.user_id, 'joined_at', NEW.joined_at),
                COALESCE(NEW.joined_at, NOW())
            FROM group_members gm
            WHERE gm.group_id = NEW.group_id
              AND gm.is_active = true
              AND gm.user_id <> NEW.user_id
            ON CONFLICT (user_id, kind, ref_id) DO NOTHING;
        END IF;

        IF v_is_leave THEN
            -- Snapshot the group name now; the removed member can't read it later.
            SELECT name INTO v_group_name FROM groups WHERE id = NEW.group_id;

            INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata, created_at)
            VALUES (
                NEW.user_id,
                'group_removed',
                NEW.group_id,
                NEW.id,
                -- Actor is whoever performed the removal. NULL for a self-leave
                -- (auth.uid() = the leaving member) so it renders as "You left".
                NULLIF(auth.uid(), NEW.user_id),
                jsonb_build_object('left_at', NEW.left_at, 'group_name', v_group_name),
                COALESCE(NEW.left_at, NOW())
            )
            ON CONFLICT (user_id, kind, ref_id) DO NOTHING;
        END IF;

        RETURN NEW;
    END;
    $$;
