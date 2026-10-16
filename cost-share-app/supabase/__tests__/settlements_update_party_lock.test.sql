-- #298 — Settlement UPDATE adversarial cases.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_alice CONSTANT UUID := '00000000-0000-0000-0000-000000298001';
    v_bob   CONSTANT UUID := '00000000-0000-0000-0000-000000298002';
    v_carol CONSTANT UUID := '00000000-0000-0000-0000-000000298003';
    v_group CONSTANT UUID := '00000000-0000-0000-0000-000000298010';
    v_settle CONSTANT UUID := '00000000-0000-0000-0000-000000298020';
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_alice, 'su298-alice@test.local'),
        (v_bob,   'su298-bob@test.local'),
        (v_carol, 'su298-carol@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token) VALUES
        (v_alice, 'Alice', 'ILS', TRUE, 'su298Alice12'),
        (v_bob,   'Bob',   'ILS', TRUE, 'su298Bob0123'),
        (v_carol, 'Carol', 'ILS', TRUE, 'su298Carol12');
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'SU298', 'ILS', TRUE, v_alice, 'su298Group123');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_alice, TRUE),
        (v_group, v_bob, TRUE),
        (v_group, v_carol, TRUE);
    INSERT INTO public.settlements (
        id, group_id, from_user_id, to_user_id, amount, currency, settlement_date, created_by
    ) VALUES (
        v_settle, v_group, v_alice, v_bob, 20, 'ILS', CURRENT_DATE, v_alice
    );

    SET LOCAL session_replication_role = origin;
    PERFORM public.test_set_authenticated(v_carol);

    BEGIN
        UPDATE public.settlements SET currency = 'USD' WHERE id = v_settle;
        RAISE EXCEPTION 'Case A failed: non-party Carol must not update settlement';
    EXCEPTION WHEN insufficient_privilege OR check_violation OR OTHERS THEN
        IF SQLERRM NOT LIKE '%row-level security%' AND SQLERRM NOT LIKE '%42501%' THEN
            RAISE;
        END IF;
    END;

    PERFORM public.test_set_authenticated(v_alice);

    UPDATE public.settlements SET payment_method = 'cash' WHERE id = v_settle;

    BEGIN
        UPDATE public.settlements SET amount = 999 WHERE id = v_settle;
        RAISE EXCEPTION 'Case B failed: amount change must be blocked';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%settlement_core_fields_immutable%' AND SQLERRM NOT LIKE '%42501%' THEN
            RAISE;
        END IF;
    END;
END;
$outer$;

ROLLBACK;
