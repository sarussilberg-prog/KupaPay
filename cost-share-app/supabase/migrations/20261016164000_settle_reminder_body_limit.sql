-- #267 — Cap custom settle reminder push body length.

CREATE OR REPLACE FUNCTION send_settle_reminder(
    p_group_id    UUID,
    p_to_user_id  UUID,
    p_message     TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_recent INT;
    v_body TEXT;
BEGIN
    IF NOT is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'not_group_member';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = p_group_id
          AND user_id = p_to_user_id
          AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'recipient_not_group_member';
    END IF;
    IF p_to_user_id = auth.uid() THEN
        RAISE EXCEPTION 'cannot_remind_self';
    END IF;

    v_body := regexp_replace(btrim(COALESCE(p_message, '')), '[[:cntrl:]]', '', 'g');
    IF char_length(v_body) < 1 OR char_length(v_body) > 280 THEN
        RAISE EXCEPTION 'settle_reminder_body_invalid' USING ERRCODE = '22023';
    END IF;

    SELECT COUNT(*)::INT INTO v_recent
    FROM activity_events
    WHERE kind = 'settle_up_reminder'
      AND group_id = p_group_id
      AND user_id = p_to_user_id
      AND actor_user_id = auth.uid()
      AND created_at > NOW() - INTERVAL '24 hours';

    IF v_recent >= 5 THEN
        RAISE EXCEPTION 'settle_reminder_rate_limit_exceeded' USING ERRCODE = '42501';
    END IF;

    INSERT INTO activity_events (
        id, user_id, kind, group_id, ref_id, actor_user_id, metadata
    ) VALUES (
        gen_random_uuid(),
        p_to_user_id,
        'settle_up_reminder',
        p_group_id,
        gen_random_uuid(),
        auth.uid(),
        jsonb_build_object('body', v_body)
    );
END;
$$;
