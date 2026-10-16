-- Self-profile SELECT must succeed under profiles_select_scoped (regression: #348 / dev drift).
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_user  CONSTANT UUID := '00000000-0000-0000-0000-000000b00101';
    v_peer  CONSTANT UUID := '00000000-0000-0000-0000-000000b00102';
    v_group CONSTANT UUID := '00000000-0000-0000-0000-000000b00110';
    v_name  TEXT;
    v_payload JSONB;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_user, 'self-read@test.local'),
        (v_peer, 'peer-read@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token) VALUES
        (v_user, 'Self Reader', 'ILS', TRUE, 'selfRead12345'),
        (v_peer, 'Peer User', 'ILS', TRUE, 'peerUser12345');
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'Self read group', 'ILS', TRUE, v_user, 'selfGrp123456');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_user, TRUE),
        (v_group, v_peer, TRUE);
    INSERT INTO public.expenses (
        id, group_id, description, amount, currency, expense_date, paid_by, created_by, split_mode
    ) VALUES (
        '00000000-0000-0000-0000-000000b00120',
        v_group,
        'Coffee',
        20,
        'ILS',
        CURRENT_DATE,
        v_user,
        v_user,
        'equal'
    );
    INSERT INTO public.expense_splits (expense_id, user_id, amount) VALUES
        ('00000000-0000-0000-0000-000000b00120', v_user, 10),
        ('00000000-0000-0000-0000-000000b00120', v_peer, 10);

    SET LOCAL session_replication_role = origin;

    PERFORM public.test_set_authenticated(v_user);

    SELECT name INTO v_name FROM public.profiles WHERE id = v_user;
    IF v_name IS DISTINCT FROM 'Self Reader' THEN
        RAISE EXCEPTION 'Case 1 failed: self profile read returned name %', v_name;
    END IF;

    v_payload := public.get_user_simplified_inputs(v_user);
    IF v_payload IS NULL OR jsonb_array_length(v_payload->'groups') < 1 THEN
        RAISE EXCEPTION 'Case 2 failed: get_user_simplified_inputs must return group nets for self';
    END IF;

    RAISE NOTICE 'profiles_self_read_rls.test.sql — passed';
END;
$outer$;

ROLLBACK;
