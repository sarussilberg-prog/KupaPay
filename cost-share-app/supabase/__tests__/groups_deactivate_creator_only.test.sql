-- #318 — Only group creator may set groups.is_active = false.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_owner CONSTANT UUID := '00000000-0000-0000-0000-000000318001';
    v_mem   CONSTANT UUID := '00000000-0000-0000-0000-000000318002';
    v_group CONSTANT UUID := '00000000-0000-0000-0000-000000318010';
    v_rows  INT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_owner, 'g318-owner@test.local'),
        (v_mem,   'g318-mem@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token) VALUES
        (v_owner, 'Owner', 'ILS', TRUE, 'g318Owner1234'),
        (v_mem,   'Mem',   'ILS', TRUE, 'g318Mem01234');
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'G318', 'ILS', TRUE, v_owner, 'g318Group1234');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_owner, TRUE),
        (v_group, v_mem, TRUE);

    SET LOCAL session_replication_role = origin;
    PERFORM public.test_set_authenticated(v_mem);

    BEGIN
        UPDATE public.groups SET is_active = FALSE WHERE id = v_group;
        RAISE EXCEPTION 'Case A failed: member must not deactivate group';
    EXCEPTION WHEN insufficient_privilege OR check_violation OR OTHERS THEN
        IF SQLERRM NOT LIKE '%group_deactivate_creator_only%'
           AND SQLERRM NOT LIKE '%42501%' THEN
            RAISE;
        END IF;
    END;

    PERFORM public.test_set_authenticated(v_owner);
    UPDATE public.groups SET is_active = FALSE WHERE id = v_group;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'Case B failed: creator must deactivate group';
    END IF;
END;
$outer$;

ROLLBACK;
