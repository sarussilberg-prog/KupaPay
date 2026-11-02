-- require_pro_for_group_export enforces membership and Pro before PDF export RPC.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_user  CONSTANT UUID := '00000000-0000-4000-8000-000000014401';
    v_group CONSTANT UUID := '00000000-0000-4000-8000-000000014402';
BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_user, 'export141@test.local');
    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token, pro_until)
        VALUES (v_user, 'export141@test.local', 'Exp', 'USD', 'en', TRUE, 'tok142', NULL);
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'G', 'USD', TRUE, v_user, 'grp142');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES (v_group, v_user, TRUE);

    SET LOCAL session_replication_role = origin;
    PERFORM public.test_set_authenticated(v_user);

    BEGIN
        PERFORM public.require_pro_for_group_export(v_group);
        RAISE EXCEPTION 'Case 1 failed: non-Pro should be rejected';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%pro_required%' THEN
            RAISE;
        END IF;
    END;

    UPDATE public.profiles SET pro_until = NOW() + INTERVAL '30 days' WHERE id = v_user;
    PERFORM public.require_pro_for_group_export(v_group);

    RAISE NOTICE 'require_pro_export.test.sql — passed';
END;
$outer$;

ROLLBACK;
