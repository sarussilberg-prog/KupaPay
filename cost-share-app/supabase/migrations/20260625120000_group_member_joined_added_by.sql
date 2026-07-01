-- Record WHO added a member on the group_member_joined fan-out event.
--
-- group_member_joined fires for every OTHER active member when someone joins.
-- Until now it only carried new_member_user_id, so the feed could only ever say
-- "{{member}} joined {{group}}" — even for the existing member who performed the
-- add. Capturing NEW.added_by lets the client recognise its own action and render
-- "You added {{member}}" instead.
--
-- The recipient (activity_events.user_id) is each existing member; when that
-- recipient is the adder (added_by = the viewer), the client shows the
-- first-person "You added …" copy. Self-joins via invite link store a NULL
-- added_by, so the field is simply absent and the copy stays "{{member}} joined".
--
-- Supersedes 20260622160000. Only the trigger function changes; the
-- group_added / group_removed branches are byte-for-byte identical. Idempotent.
-- Forward-only: events emitted before this migration lack added_by_user_id and
-- keep rendering "{{member}} joined".

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
    BEGIN
        IF TG_OP = 'INSERT' AND NEW.is_active = true THEN
            v_is_join := true;
        ELSIF TG_OP = 'UPDATE' AND OLD.is_active = false AND NEW.is_active = true THEN
            v_is_join := true;
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

            -- One row for the new member.
            INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata, created_at)
            VALUES (
                NEW.user_id,
                'group_added',
                NEW.group_id,
                gen_random_uuid(),
                NEW.added_by,
                jsonb_build_object(
                    'joined_at', NEW.joined_at,
                    'group_name', v_group_name,
                    'member_row_id', NEW.id
                ),
                COALESCE(NEW.joined_at, NOW())
            )
            ON CONFLICT (user_id, kind, ref_id) DO NOTHING;

            -- One row per OTHER active member.
            INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata, created_at)
            SELECT
                gm.user_id,
                'group_member_joined',
                NEW.group_id,
                gen_random_uuid(),
                NEW.user_id,
                jsonb_build_object(
                    'new_member_user_id', NEW.user_id,
                    'added_by_user_id', NEW.added_by,
                    'joined_at', NEW.joined_at,
                    'group_name', v_group_name,
                    'member_row_id', NEW.id
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
                gen_random_uuid(),
                -- Actor is whoever performed the removal. NULL for a self-leave
                -- (auth.uid() = the leaving member) so it renders as "You left".
                NULLIF(auth.uid(), NEW.user_id),
                jsonb_build_object(
                    'left_at', NEW.left_at,
                    'group_name', v_group_name,
                    'member_row_id', NEW.id
                ),
                COALESCE(NEW.left_at, NOW())
            )
            ON CONFLICT (user_id, kind, ref_id) DO NOTHING;
        END IF;

        RETURN NEW;
    END;
    $$;
