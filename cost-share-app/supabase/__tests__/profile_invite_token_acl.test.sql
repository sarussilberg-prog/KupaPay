-- Column ACL: authenticated users must not read other users' invite_token via PostgREST.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_alice CONSTANT UUID := '00000000-0000-0000-0000-00000000acl001';
    v_bob   CONSTANT UUID := '00000000-0000-0000-0000-00000000acl002';
    v_tok   TEXT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_alice, 'acl-alice@test.local'),
        (v_bob,   'acl-bob@test.local');

    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token) VALUES
        (v_alice, 'acl-alice@test.local', 'Alice', 'ILS', 'he', TRUE, 'aliceSecret01'),
        (v_bob,   'acl-bob@test.local',   'Bob',   'ILS', 'he', TRUE, 'bobSecret0123');

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_alice::text)::text, TRUE);
    PERFORM set_config('role', 'authenticated', TRUE);

    SELECT invite_token INTO v_tok FROM public.profiles WHERE id = v_bob;
    IF v_tok IS NOT NULL THEN
        RAISE EXCEPTION 'Bob invite_token should be hidden from column ACL (got %)', v_tok;
    END IF;

    SELECT public.get_my_invite_token() INTO v_tok;
    IF v_tok <> 'aliceSecret01' THEN
        RAISE EXCEPTION 'get_my_invite_token should return Alice token (got %)', v_tok;
    END IF;
END;
$outer$;

ROLLBACK;
