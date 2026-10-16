-- #264 — Members cannot PATCH Pro-only groups columns via RLS UPDATE.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_member CONSTANT UUID := '00000000-0000-0000-0000-000000006401';
    v_group  CONSTANT UUID := '00000000-0000-0000-0000-000000006410';
BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_member, 'gp64@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token)
        VALUES (v_member, 'Mem', 'ILS', TRUE, 'gp64MemTok123');
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'Pro guard', 'ILS', TRUE, v_member, 'gp64GrpTok123');
    INSERT INTO public.group_members (group_id, user_id, is_active)
        VALUES (v_group, v_member, TRUE);

    PERFORM public.test_set_authenticated(v_member);

    -- Triggers are disabled under replica role; enable for guard assertion.
    SET LOCAL session_replication_role = origin;

    BEGIN
        UPDATE public.groups
        SET smart_reminder_enabled = TRUE,
            smart_reminder_set_by = v_member
        WHERE id = v_group;
        RAISE EXCEPTION 'Case A failed: direct Pro column PATCH should be denied';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%pro_group_fields_rpc_only%' AND SQLERRM NOT LIKE '%42501%' THEN
            RAISE;
        END IF;
    END;

    SET LOCAL session_replication_role = replica;
END;
$outer$;

ROLLBACK;
