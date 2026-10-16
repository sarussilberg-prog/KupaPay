-- Fan-out triggers must see all active members, not only co-members visible under
-- the editor's JWT RLS session (SQL CI + authenticated note saves).

CREATE OR REPLACE FUNCTION emit_group_activity_events() RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
        v_actor UUID := auth.uid();
    BEGIN
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
            IF OLD.is_active = true AND NEW.is_active = false THEN
                SET LOCAL row_security = off;
                INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata, created_at)
                SELECT gm.user_id, 'group_deleted', NEW.id, gen_random_uuid(), v_actor,
                       jsonb_build_object('group_name', NEW.name), NOW()
                FROM group_members gm
                WHERE gm.group_id = NEW.id AND gm.is_active = true
                ON CONFLICT (user_id, kind, ref_id) DO NOTHING;
                SET LOCAL row_security = on;
                RETURN NEW;
            END IF;

            IF NEW.is_active = true AND NEW.note IS DISTINCT FROM OLD.note THEN
                SET LOCAL row_security = off;
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
                SET LOCAL row_security = on;

                IF v_actor IS NOT NULL THEN
                    UPDATE group_members SET note_seen_at = NOW()
                    WHERE group_id = NEW.id AND user_id = v_actor;
                END IF;
            END IF;
        END IF;

        RETURN NEW;
    END;
    $$;
