-- #285 — invite_token changes require rotate_group_invite RPC.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_member CONSTANT UUID := '00000000-0000-0000-0000-000000285001';
    v_group  CONSTANT UUID := '00000000-0000-0000-0000-000000285010';
    v_new    TEXT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_member, 'inv285@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token)
        VALUES (v_member, 'Mem', 'ILS', TRUE, 'inv285MemTok12');
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'Inv guard', 'ILS', TRUE, v_member, 'inv285GrpTok12');
    INSERT INTO public.group_members (group_id, user_id, is_active)
        VALUES (v_group, v_member, TRUE);

    SET LOCAL session_replication_role = origin;
    PERFORM public.test_set_authenticated(v_member);

    BEGIN
        UPDATE public.groups SET invite_token = 'hijackedTok12' WHERE id = v_group;
        RAISE EXCEPTION 'Case A failed: direct invite_token PATCH should be denied';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%group_invite_token_rpc_only%' AND SQLERRM NOT LIKE '%42501%' THEN
            RAISE;
        END IF;
    END;

    SELECT public.rotate_group_invite(v_group) INTO v_new;
    IF v_new IS NULL OR length(v_new) < 12 THEN
        RAISE EXCEPTION 'Case B failed: rotate_group_invite should return new token';
    END IF;
END;
$outer$;

ROLLBACK;
