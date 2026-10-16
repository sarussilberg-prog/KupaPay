-- #286 — INSERT RLS binds settlements to parties and expenses to creator.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_alice CONSTANT UUID := '00000000-0000-0000-0000-000000286001';
    v_bob   CONSTANT UUID := '00000000-0000-0000-0000-000000286002';
    v_carol CONSTANT UUID := '00000000-0000-0000-0000-000000286003';
    v_group CONSTANT UUID := '00000000-0000-0000-0000-000000286010';
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_alice, 'rls286-alice@test.local'),
        (v_bob,   'rls286-bob@test.local'),
        (v_carol, 'rls286-carol@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token) VALUES
        (v_alice, 'Alice', 'ILS', TRUE, 'rls286Alice12'),
        (v_bob,   'Bob',   'ILS', TRUE, 'rls286Bob0123'),
        (v_carol, 'Carol', 'ILS', TRUE, 'rls286Carol12');
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'RLS286', 'ILS', TRUE, v_alice, 'rls286Group123');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_alice, TRUE),
        (v_group, v_bob, TRUE);

    SET LOCAL session_replication_role = origin;
    PERFORM public.test_set_authenticated(v_alice);

    -- Case A: forged settlement (Alice not a party) → denied
    BEGIN
        INSERT INTO public.settlements (
            group_id, from_user_id, to_user_id, amount, currency, settlement_date, created_by
        ) VALUES (
            v_group, v_bob, v_carol, 10, 'ILS', CURRENT_DATE, v_alice
        );
        RAISE EXCEPTION 'Case A failed: non-party settlement INSERT should be denied';
    EXCEPTION WHEN insufficient_privilege OR check_violation OR OTHERS THEN
        IF SQLERRM NOT LIKE '%row-level security%' AND SQLERRM NOT LIKE '%42501%' THEN
            RAISE;
        END IF;
    END;

    -- Case B: cross-group style — Alice records payment she made to Bob (#239)
    INSERT INTO public.settlements (
        group_id, from_user_id, to_user_id, amount, currency, settlement_date, created_by
    ) VALUES (
        v_group, v_alice, v_bob, 5, 'ILS', CURRENT_DATE, v_alice
    );

    -- Case C: expense with wrong created_by via direct INSERT → denied
    BEGIN
        INSERT INTO public.expenses (
            group_id, description, amount, currency, paid_by, created_by, is_deleted
        ) VALUES (
            v_group, 'forge', 1, 'ILS', v_alice, v_bob, FALSE
        );
        RAISE EXCEPTION 'Case C failed: expense created_by must match auth.uid()';
    EXCEPTION WHEN insufficient_privilege OR check_violation OR OTHERS THEN
        IF SQLERRM NOT LIKE '%row-level security%' AND SQLERRM NOT LIKE '%42501%' THEN
            RAISE;
        END IF;
    END;
END;
$outer$;

ROLLBACK;
