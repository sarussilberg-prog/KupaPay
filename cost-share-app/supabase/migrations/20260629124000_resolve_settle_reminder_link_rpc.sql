-- resolve_settle_reminder_link: called when recipient opens a /sr/<token> share link.
-- Returns the group_id if current user is a member, or an error key.
CREATE OR REPLACE FUNCTION resolve_settle_reminder_link(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_group_id UUID;
BEGIN
    SELECT id INTO v_group_id FROM groups WHERE invite_token = p_token;

    IF v_group_id IS NULL THEN
        RETURN jsonb_build_object('error', 'not_found');
    END IF;

    -- is_group_member() checks the caller (auth.uid()).
    IF NOT is_group_member(v_group_id) THEN
        RETURN jsonb_build_object('error', 'not_member');
    END IF;

    RETURN jsonb_build_object('group_id', v_group_id);
END;
$$;
