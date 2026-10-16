-- #263 — Legacy get_user_dashboard / get_user_balance_summary must not be callable.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_user CONSTANT UUID := '00000000-0000-0000-0000-000000lb6301';
BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_user, 'lb63@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token)
        VALUES (v_user, 'LB', 'ILS', TRUE, 'lb63Tok012345');
    PERFORM public.test_set_authenticated(v_user);

    BEGIN
        PERFORM public.get_user_dashboard(v_user);
        RAISE EXCEPTION 'Case A failed: get_user_dashboard should not exist';
    EXCEPTION
        WHEN undefined_function THEN NULL;
        WHEN OTHERS THEN
            IF SQLERRM NOT LIKE '%does not exist%' THEN
                RAISE;
            END IF;
    END;

    BEGIN
        PERFORM public.get_user_balance_summary(v_user);
        RAISE EXCEPTION 'Case B failed: get_user_balance_summary should not exist';
    EXCEPTION
        WHEN undefined_function THEN NULL;
        WHEN OTHERS THEN
            IF SQLERRM NOT LIKE '%does not exist%' THEN
                RAISE;
            END IF;
    END;
END;
$outer$;

ROLLBACK;
