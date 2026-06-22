-- Keep the FULL history of group add/remove cycles in the activity feed.
--
-- Bug: a membership is one group_members row per (group, user); add/remove/re-add
-- all reuse that row (is_active toggles), so its id is stable across cycles.
-- activity_events keys membership rows by ref_id = group_members.id under
-- UNIQUE(user_id, kind, ref_id), so every cycle's events collided on that key —
-- and the rejoin branch DELETEd the prior group_added/group_removed/joined rows to
-- get past the constraint. Net effect: each cycle overwrote the previous one, so
-- only the most recent add/remove ever showed.
--
-- Fix: give each membership event its OWN ref_id (gen_random_uuid()) so cycles no
-- longer collide, and drop the history-erasing rejoin DELETE. The client navigates
-- membership events by group_id, not ref_id (only expense/settlement/message use
-- ref_id), so this carries no client meaning here. The group_members row id is
-- preserved in metadata.member_row_id for traceability. The global
-- UNIQUE(user_id, kind, ref_id) and the expense/settlement dedup are untouched —
-- a random ref_id simply never conflicts.
--
-- Supersedes 20260622150000 (group_name snapshot retained). Only the trigger
-- function changes. Idempotent. Forward-only: history already collapsed by the old
-- DELETE can't be recovered, but every cycle from here on persists.

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
