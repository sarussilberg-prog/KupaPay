-- #533 — invite redemption RPCs return structured error_code (no English exceptions).
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_user CONSTANT UUID := '00000000-0000-0000-0000-000000533001';
    v_res JSON;
BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_user, 'ir533@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token)
        VALUES (v_user, 'U', 'USD', TRUE, 'ir533UserTok1');

    PERFORM public.test_set_authenticated(v_user);

    v_res := public.redeem_group_invite('missingGroupTok');
    IF (v_res->>'ok')::boolean IS NOT FALSE
        OR v_res->>'error_code' IS DISTINCT FROM 'invite_not_found' THEN
        RAISE EXCEPTION 'group invite_not_found failed: %', v_res;
    END IF;

    v_res := public.redeem_friend_invite('ir533UserTok1');
    IF (v_res->>'ok')::boolean IS NOT FALSE
        OR v_res->>'error_code' IS DISTINCT FROM 'cannot_self_invite' THEN
        RAISE EXCEPTION 'friend cannot_self_invite failed: %', v_res;
    END IF;

    RAISE NOTICE 'invite_redeem_rpc_error_codes.test.sql — passed';
END;
$outer$;

ROLLBACK;
