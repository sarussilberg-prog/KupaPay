-- #348 — co-group helper is not client-callable; profiles RLS still allows co-members.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_a CONSTANT UUID := '00000000-0000-0000-0000-000000348101';
    v_b CONSTANT UUID := '00000000-0000-0000-0000-000000348102';
    v_g CONSTANT UUID := '00000000-0000-0000-0000-000000348110';
    v_name TEXT;
BEGIN
    IF has_function_privilege(
        'authenticated',
        'public.profile_shares_active_group_with_viewer(uuid)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'authenticated must not EXECUTE profile_shares_active_group_with_viewer';
    END IF;

    INSERT INTO auth.users (id, email) VALUES
        (v_a, 'p348a@test.local'),
        (v_b, 'p348b@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token) VALUES
        (v_a, 'A348', 'USD', TRUE, 'p348Aaaaaaa'),
        (v_b, 'B348', 'USD', TRUE, 'p348Bbbbbbb');
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_g, 'G348', 'USD', TRUE, v_a, 'p348Groupbbb');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_g, v_a, TRUE),
        (v_g, v_b, TRUE);

    SET LOCAL session_replication_role = origin;
    PERFORM public.test_set_authenticated(v_a);

    SELECT name INTO v_name FROM public.profiles WHERE id = v_b;
    IF v_name IS DISTINCT FROM 'B348' THEN
        RAISE EXCEPTION 'co-member profile not visible, got %', v_name;
    END IF;
END;
$outer$;

ROLLBACK;
