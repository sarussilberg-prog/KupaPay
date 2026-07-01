-- send_settle_reminder: called by the sender's app.
-- Inserts an activity_events row for the recipient; existing pg_net trigger
-- fires send-push automatically. The custom message is stored in metadata.body
-- (consistent with handler.ts md.body pattern used by message_posted).
CREATE OR REPLACE FUNCTION send_settle_reminder(
    p_group_id    UUID,
    p_to_user_id  UUID,
    p_message     TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Caller must be a group member (is_group_member() checks auth.uid()).
    IF NOT is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'not_group_member';
    END IF;
    -- Recipient must be an active group member. is_group_member() can only check
    -- the caller (auth.uid()), so verify the recipient directly against
    -- group_members — this RPC is SECURITY DEFINER so it bypasses RLS.
    IF NOT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = p_group_id
          AND user_id = p_to_user_id
          AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'recipient_not_group_member';
    END IF;
    -- Cannot remind yourself
    IF p_to_user_id = auth.uid() THEN
        RAISE EXCEPTION 'cannot_remind_self';
    END IF;

    INSERT INTO activity_events (
        id, user_id, kind, group_id, ref_id, actor_user_id, metadata
    ) VALUES (
        gen_random_uuid(),
        p_to_user_id,
        'settle_up_reminder',
        p_group_id,
        -- ref_id: no linked resource row; random UUID satisfies NOT NULL
        gen_random_uuid(),
        auth.uid(),
        jsonb_build_object('body', p_message)
    );
END;
$$;
