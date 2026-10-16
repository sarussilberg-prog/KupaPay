-- #317 — Only expense creator may DELETE expense_splits rows.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_alice CONSTANT UUID := '00000000-0000-0000-0000-000000317001';
    v_bob   CONSTANT UUID := '00000000-0000-0000-0000-000000317002';
    v_group CONSTANT UUID := '00000000-0000-0000-0000-000000317010';
    v_exp   CONSTANT UUID := '00000000-0000-0000-0000-000000317020';
    v_rows  INT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_alice, 'es317-alice@test.local'),
        (v_bob,   'es317-bob@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token) VALUES
        (v_alice, 'Alice', 'ILS', TRUE, 'es317Alice12'),
        (v_bob,   'Bob',   'ILS', TRUE, 'es317Bob0123');
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'ES317', 'ILS', TRUE, v_alice, 'es317Group123');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_alice, TRUE),
        (v_group, v_bob, TRUE);
    INSERT INTO public.expenses (
        id, group_id, description, amount, currency, expense_date, paid_by, created_by, split_mode
    ) VALUES (
        v_exp, v_group, 'Dinner', 40, 'ILS', CURRENT_DATE, v_alice, v_alice, 'equal'
    );
    INSERT INTO public.expense_splits (expense_id, user_id, amount) VALUES
        (v_exp, v_alice, 20),
        (v_exp, v_bob, 20);

    SET LOCAL session_replication_role = origin;
    PERFORM public.test_set_authenticated(v_bob);

    DELETE FROM public.expense_splits WHERE expense_id = v_exp AND user_id = v_bob;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN
        RAISE EXCEPTION 'Case A failed: non-creator must not delete splits';
    END IF;

    PERFORM public.test_set_authenticated(v_alice);
    DELETE FROM public.expense_splits WHERE expense_id = v_exp AND user_id = v_bob;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'Case B failed: creator must delete splits';
    END IF;
END;
$outer$;

ROLLBACK;
