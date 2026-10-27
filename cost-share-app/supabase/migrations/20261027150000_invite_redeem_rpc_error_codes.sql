-- #533 — structured { ok, error_code } for invite redemption RPCs (KI-017).

CREATE OR REPLACE FUNCTION public.redeem_friend_invite(p_token TEXT) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_me UUID := auth.uid();
    v_inviter_id UUID;
    v_inviter_name TEXT;
    v_a UUID;
    v_b UUID;
BEGIN
    IF v_me IS NULL THEN
        RETURN json_build_object('ok', false, 'error_code', 'not_authenticated');
    END IF;

    SELECT id, name INTO v_inviter_id, v_inviter_name
    FROM profiles WHERE invite_token = p_token LIMIT 1;

    IF v_inviter_id IS NULL THEN
        RETURN json_build_object('ok', false, 'error_code', 'invite_not_found');
    END IF;
    IF v_inviter_id = v_me THEN
        RETURN json_build_object('ok', false, 'error_code', 'cannot_self_invite');
    END IF;

    PERFORM public._attribute_referral(v_inviter_id, v_me);

    IF v_me < v_inviter_id THEN
        v_a := v_me; v_b := v_inviter_id;
    ELSE
        v_a := v_inviter_id; v_b := v_me;
    END IF;

    INSERT INTO friendships (user_a_id, user_b_id, source)
    VALUES (v_a, v_b, 'request')
    ON CONFLICT (user_a_id, user_b_id) DO NOTHING;

    DELETE FROM friend_blocks
    WHERE (user_id = v_me AND blocked_user_id = v_inviter_id)
       OR (user_id = v_inviter_id AND blocked_user_id = v_me);

    RETURN json_build_object(
        'ok', true,
        'friend_id', v_inviter_id,
        'friend_name', v_inviter_name
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_group_invite(p_token TEXT) RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_me UUID := auth.uid();
    v_group_id UUID;
    v_group_name TEXT;
    v_already BOOLEAN;
BEGIN
    IF v_me IS NULL THEN
        RETURN json_build_object('ok', false, 'error_code', 'not_authenticated');
    END IF;

    SELECT id, name INTO v_group_id, v_group_name
    FROM groups WHERE invite_token = p_token AND is_active = true LIMIT 1;

    IF v_group_id IS NULL THEN
        RETURN json_build_object('ok', false, 'error_code', 'invite_not_found');
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = v_group_id AND user_id = v_me AND is_active = true
    ) INTO v_already;

    INSERT INTO group_members (group_id, user_id, is_active, left_at, joined_at)
    VALUES (v_group_id, v_me, true, NULL, now())
    ON CONFLICT (group_id, user_id)
    DO UPDATE SET is_active = true, left_at = NULL, joined_at = now();

    RETURN json_build_object(
        'ok', true,
        'group_id', v_group_id,
        'group_name', v_group_name,
        'already_member', v_already
    );
END;
$$;
