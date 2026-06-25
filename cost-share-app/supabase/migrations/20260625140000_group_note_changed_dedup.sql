-- Coalesce group_note_changed so a note edit produces ONE activity row, not one
-- per autosave.
--
-- Bug: GroupNoteScreen autosaves the note every ~900ms while typing, so a single
-- logical edit writes groups.note several times. The original trigger
-- (20260625130000) inserted a fresh row per write (ref_id = gen_random_uuid()),
-- so the feed showed N duplicate "Note changed by …" rows and fired N pushes.
--
-- Fix: give group_note_changed a STABLE ref_id = group id, so UNIQUE(user_id,
-- kind, ref_id) keeps exactly one row per (user, group). On repeat edits, only
-- "resurface" the row (bump created_at → re-sort + re-push via the edit webhook)
-- when the prior event is older than NOTE_COALESCE_WINDOW; within that window the
-- autosave burst is absorbed into the single existing row with no new push.
--
-- group_created (ref_id = group id, fired once) and group_deleted (one-time soft
-- delete) are unchanged. Supersedes the group_note_changed branch only.

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

            -- group_note_changed: one row per (user, group). ref_id = group id so
            -- repeated autosaves collide on UNIQUE(user_id, kind, ref_id). The row
            -- only resurfaces (created_at bumped → re-push) when the previous event
            -- is older than the coalesce window; a rapid autosave burst is absorbed.
            IF NEW.is_active = true AND NEW.note IS DISTINCT FROM OLD.note THEN
                INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata, created_at)
                SELECT gm.user_id, 'group_note_changed', NEW.id, NEW.id, v_actor,
                       jsonb_build_object('group_name', NEW.name), NOW()
                FROM group_members gm
                WHERE gm.group_id = NEW.id AND gm.is_active = true
                ON CONFLICT (user_id, kind, ref_id) DO UPDATE
                    SET created_at = CASE
                        WHEN activity_events.created_at < NOW() - INTERVAL '5 minutes'
                        THEN NOW()
                        ELSE activity_events.created_at
                    END;

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
