-- Regression: archive_group returns JSONB { ok, error_code } (not English exceptions).

BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_user  CONSTANT UUID := '00000000-0000-0000-0000-0000000a8100';
    v_group CONSTANT UUID := '00000000-0000-0000-0000-0000000a8101';
    v_result JSONB;
BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_user, 'arch-rpc@test.local');
    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token)
        VALUES (v_user, 'arch-rpc@test.local', 'Arch', 'USD', 'en', TRUE, 'arch_rpc_tok');
    INSERT INTO public.groups (id, name, default_currency, created_by, invite_token)
        VALUES (v_group, 'G', 'USD', v_user, 'grp_rpc_tok');

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text)::text, TRUE);

    v_result := public.archive_group(v_group);
    IF v_result->>'ok' IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION 'expected ok=true for empty group, got %', v_result;
    END IF;

    RAISE NOTICE 'archive_group_rpc_result.test.sql — passed';
END;
$outer$;

ROLLBACK;
