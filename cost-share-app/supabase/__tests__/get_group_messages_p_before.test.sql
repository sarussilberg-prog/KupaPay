-- #534 — get_group_messages exposes optional p_before cursor (dev/prod parity via migration 20261016121000).
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_user  CONSTANT UUID := '00000000-0000-0000-0000-000000534001';
    v_group CONSTANT UUID := '00000000-0000-0000-0000-000000534010';
    v_old   TIMESTAMPTZ := NOW() - INTERVAL '2 days';
    v_mid   TIMESTAMPTZ := NOW() - INTERVAL '1 day';
    v_new   TIMESTAMPTZ := NOW() - INTERVAL '1 hour';
    v_count INT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_user, 'msg534@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token)
        VALUES (v_user, 'Msg534', 'USD', TRUE, 'tt_msg534_u');
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'Msg534', 'USD', TRUE, v_user, 'tt_msg534_g');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES (v_group, v_user, TRUE);

    INSERT INTO public.group_messages (group_id, user_id, body, created_at, is_deleted)
        VALUES
            (v_group, v_user, 'old', v_old, FALSE),
            (v_group, v_user, 'mid', v_mid, FALSE),
            (v_group, v_user, 'new', v_new, FALSE);

    PERFORM public.test_set_authenticated(v_user);

    SELECT COUNT(*) INTO v_count
    FROM public.get_group_messages(v_group, 100, v_mid);
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'p_before filter failed: expected 1 message older than mid, got %', v_count;
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM public.get_group_messages(v_group, 100, NULL);
    IF v_count <> 3 THEN
        RAISE EXCEPTION 'null p_before failed: expected 3 messages, got %', v_count;
    END IF;
END;
$outer$;

ROLLBACK;
