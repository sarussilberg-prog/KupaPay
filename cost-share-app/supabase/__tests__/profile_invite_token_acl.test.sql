-- Column ACL: authenticated users must not read other users' invite_token via PostgREST.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_alice CONSTANT UUID := '00000000-0000-0000-0000-000000a01001';
    v_bob   CONSTANT UUID := '00000000-0000-0000-0000-000000a01002';
    v_tok   TEXT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_alice, 'acl-alice@test.local'),
        (v_bob,   'acl-bob@test.local');

    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token) VALUES
        (v_alice, 'acl-alice@test.local', 'Alice', 'ILS', 'he', TRUE, 'aliceSecret01'),
        (v_bob,   'acl-bob@test.local',   'Bob',   'ILS', 'he', TRUE, 'bobSecret0123');

    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES ('00000000-0000-0000-0000-000000a01010', 'ACL Group', 'ILS', TRUE, v_alice, 'tt_acl_grp');
    INSERT INTO public.group_members (group_id, user_id, is_active)
        VALUES ('00000000-0000-0000-0000-000000a01010', v_alice, TRUE),
               ('00000000-0000-0000-0000-000000a01010', v_bob, TRUE);

    RESET ROLE;
    SET LOCAL session_replication_role = origin;
    PERFORM public.test_set_authenticated(v_alice);

    -- invite_token is not in authenticated column GRANTs; peer reads must fail closed (42501).
    BEGIN
        SELECT invite_token INTO v_tok FROM public.profiles WHERE id = v_bob;
        RAISE EXCEPTION 'Bob invite_token SELECT should be denied by column ACL (got %)', v_tok;
    EXCEPTION
        WHEN insufficient_privilege THEN
            NULL;
    END;

    SELECT public.get_my_invite_token() INTO v_tok;
    IF v_tok <> 'aliceSecret01' THEN
        RAISE EXCEPTION 'get_my_invite_token should return Alice token (got %)', v_tok;
    END IF;
END;
$outer$;

ROLLBACK;
