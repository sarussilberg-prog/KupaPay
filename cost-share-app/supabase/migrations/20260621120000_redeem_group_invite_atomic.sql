-- Make redeem_group_invite() idempotent under concurrent redemption.
--
-- Bug (Sentry COPAY-MOBILE-PROD-G): redeeming a group invite threw
--   duplicate key value violates unique constraint "group_members_group_id_user_id_key"
--
-- The client fires two parallel redeem_group_invite RPCs for the same invite
-- (the live-URL effect and the parked pendingInvite effect in
-- useInviteRedemption both run once `session` flips on after sign-in). The old
-- body was not atomic:
--
--   SELECT EXISTS(... is_active) INTO v_already;  -- both calls see "not a member"
--   IF v_already THEN RETURN already_member; END IF;
--   UPDATE group_members ... WHERE group_id=.. AND user_id=..;  -- both: 0 rows
--   IF NOT FOUND THEN INSERT ...; END IF;                       -- both INSERT -> 2nd violates UNIQUE
--
-- Replace the UPDATE-then-INSERT with a single atomic upsert that can't race.
-- `already_member` is now derived from the pre-existing active row so the
-- success copy ("joined" vs "already a member") is preserved.
--
-- Idempotent — re-running just rewrites the function.

CREATE OR REPLACE FUNCTION redeem_group_invite(p_token TEXT) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_me UUID := auth.uid();
    v_group_id UUID;
    v_group_name TEXT;
    v_already BOOLEAN;
BEGIN
    IF v_me IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT id, name INTO v_group_id, v_group_name
    FROM groups WHERE invite_token = p_token AND is_active = true LIMIT 1;

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'invite_not_found';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = v_group_id AND user_id = v_me AND is_active = true
    ) INTO v_already;

    -- Atomic upsert: inserts a new membership, or reactivates a prior one.
    -- ON CONFLICT makes concurrent redemptions of the same invite safe — the
    -- losing call updates the row instead of throwing a duplicate-key error.
    INSERT INTO group_members (group_id, user_id, is_active, left_at, joined_at)
    VALUES (v_group_id, v_me, true, NULL, now())
    ON CONFLICT (group_id, user_id)
    DO UPDATE SET is_active = true, left_at = NULL, joined_at = now();

    -- The existing on_group_member_insert_auto_friend trigger handles friendships.

    RETURN json_build_object(
        'group_id', v_group_id,
        'group_name', v_group_name,
        'already_member', v_already
    );
END;
$$;
