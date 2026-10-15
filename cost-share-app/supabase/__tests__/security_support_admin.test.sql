-- Regression: support admin RPCs require is_app_admin().
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_admin CONSTANT UUID := '00000000-0000-0000-0000-00000000sec001';
    v_alice CONSTANT UUID := '00000000-0000-0000-0000-00000000sec002';
    v_msg_id UUID;
    v_caught BOOLEAN;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_admin, 'sec-admin@test.local'),
        (v_alice, 'sec-alice@test.local');

    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token) VALUES
        (v_admin, 'sec-admin@test.local', 'Admin', 'ILS', 'he', TRUE, 'secadmintoken1'),
        (v_alice, 'sec-alice@test.local', 'Alice', 'ILS', 'he', TRUE, 'secalicetoken1');

    INSERT INTO public.app_admins (user_id) VALUES (v_admin);

    INSERT INTO public.support_messages (name, email, message)
        VALUES ('Tester', 't@test.local', 'hello')
        RETURNING id INTO v_msg_id;

    -- Non-admin cannot list
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_alice::text)::text, TRUE);
    v_caught := FALSE;
    BEGIN
        PERFORM public.admin_list_support_messages();
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM = 'not_authorized' THEN v_caught := TRUE; END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Expected not_authorized for admin_list_support_messages as non-admin';
    END IF;

    -- Non-admin cannot update status
    v_caught := FALSE;
    BEGIN
        PERFORM public.admin_update_support_message_status(v_msg_id, 'closed');
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM = 'not_authorized' THEN v_caught := TRUE; END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Expected not_authorized for admin_update_support_message_status as non-admin';
    END IF;

    -- Admin can list and close
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin::text)::text, TRUE);
    IF (SELECT COUNT(*) FROM public.admin_list_support_messages()) < 1 THEN
        RAISE EXCEPTION 'Admin should list support messages';
    END IF;
    PERFORM public.admin_update_support_message_status(v_msg_id, 'closed');
    IF (SELECT status FROM public.support_messages WHERE id = v_msg_id) <> 'closed' THEN
        RAISE EXCEPTION 'Admin should update support message status';
    END IF;
END;
$outer$;

ROLLBACK;
