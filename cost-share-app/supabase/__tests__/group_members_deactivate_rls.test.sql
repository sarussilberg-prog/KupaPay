-- #307 — Only group creator may deactivate others; members may leave (self).
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_owner CONSTANT UUID := '00000000-0000-0000-0000-000000307001';
    v_bob   CONSTANT UUID := '00000000-0000-0000-0000-000000307002';
    v_group CONSTANT UUID := '00000000-0000-0000-0000-000000307010';
    v_rows  INT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_owner, 'gm307-owner@test.local'),
        (v_bob,   'gm307-bob@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token) VALUES
        (v_owner, 'Owner', 'ILS', TRUE, 'gm307Owner123'),
        (v_bob,   'Bob',   'ILS', TRUE, 'gm307Bob0123');
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'GM307', 'ILS', TRUE, v_owner, 'gm307Group123');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_owner, TRUE),
        (v_group, v_bob, TRUE);

    SET LOCAL session_replication_role = origin;
    PERFORM public.test_set_authenticated(v_bob);

    UPDATE public.group_members
    SET is_active = FALSE, left_at = NOW()
    WHERE group_id = v_group AND user_id = v_owner AND is_active = TRUE;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN
        RAISE EXCEPTION 'Case A failed: member must not deactivate owner';
    END IF;

    UPDATE public.group_members
    SET is_active = FALSE, left_at = NOW()
    WHERE group_id = v_group AND user_id = v_bob AND is_active = TRUE;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'Case B failed: member must deactivate self (removeGroupMember)';
    END IF;

    INSERT INTO public.group_members (group_id, user_id, is_active)
        VALUES (v_group, v_bob, TRUE)
    ON CONFLICT (group_id, user_id) DO UPDATE SET is_active = TRUE, left_at = NULL;

    PERFORM public.test_set_authenticated(v_owner);
    UPDATE public.group_members
    SET is_active = FALSE, left_at = NOW()
    WHERE group_id = v_group AND user_id = v_bob AND is_active = TRUE;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'Case C failed: group creator must remove member';
    END IF;
END;
$outer$;

ROLLBACK;
