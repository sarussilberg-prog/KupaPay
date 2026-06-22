-- Carry the group name on join activity events too (group_added / group_member_joined).
--
-- 20260622140000 snapshotted group_name onto `group_removed` so a removed member
-- could still see "X removed you from {group}". But the *earlier* "X added you to
-- {group}" (group_added) and "X joined {group}" (group_member_joined) rows had no
-- group_name, so once the member is removed — and the group drops out of their
-- cache (RLS blocks re-reading it) — those rows render with a blank {group} too.
--
-- Fix: the SECURITY DEFINER trigger snapshots the group name into the metadata of
-- every membership event it emits. The client already falls back to
-- metadata.group_name when its live cache misses, so no client change is needed.
--
-- Supersedes 20260622140000 (group_removed snapshot retained). Only the trigger
-- function changes. Idempotent — re-running just rewrites the function.
-- Forward-only: rows written before this migration keep their old metadata.

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
            SELECT created_by, name INTO v_group_created_by, v_group_name
            FROM groups WHERE id = NEW.group_id;

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
                jsonb_build_object('joined_at', NEW.joined_at, 'group_name', v_group_name),
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
                jsonb_build_object(
                    'new_member_user_id', NEW.user_id,
                    'joined_at', NEW.joined_at,
                    'group_name', v_group_name
                ),
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
