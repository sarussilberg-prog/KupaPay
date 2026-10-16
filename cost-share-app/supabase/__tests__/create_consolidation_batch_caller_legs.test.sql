-- #295 — Each batch leg must include auth.uid().
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_alice CONSTANT UUID := '00000000-0000-0000-0000-000000295001';
    v_bob   CONSTANT UUID := '00000000-0000-0000-0000-000000295002';
    v_carol CONSTANT UUID := '00000000-0000-0000-0000-000000295003';
    v_group CONSTANT UUID := '00000000-0000-0000-0000-000000295010';
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_alice, 'cb295-alice@test.local'),
        (v_bob,   'cb295-bob@test.local'),
        (v_carol, 'cb295-carol@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token) VALUES
        (v_alice, 'Alice', 'ILS', TRUE, 'cb295Alice12'),
        (v_bob,   'Bob',   'ILS', TRUE, 'cb295Bob0123'),
        (v_carol, 'Carol', 'ILS', TRUE, 'cb295Carol12');
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'CB295', 'ILS', TRUE, v_alice, 'cb295Group123');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_alice, TRUE),
        (v_group, v_bob, TRUE),
        (v_group, v_carol, TRUE);

    SET LOCAL session_replication_role = origin;
    PERFORM public.test_set_authenticated(v_alice);

    BEGIN
        PERFORM public.create_consolidation_batch(
            v_group,
            v_alice,
            v_bob,
            'ILS',
            10,
            CURRENT_DATE,
            jsonb_build_array(jsonb_build_object(
                'currency', 'ILS',
                'amount', 10,
                'exchange_rate', 1,
                'from_user_id', v_bob,
                'to_user_id', v_carol
            ))
        );
        RAISE EXCEPTION 'Case A failed: leg without caller must be rejected';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%settlement_leg_must_involve_caller%'
           AND SQLERRM NOT LIKE '%42501%' THEN
            RAISE;
        END IF;
    END;

    PERFORM public.create_consolidation_batch(
        v_group,
        v_alice,
        v_bob,
        'ILS',
        10,
        CURRENT_DATE,
        jsonb_build_array(jsonb_build_object(
            'currency', 'ILS',
            'amount', 10,
            'exchange_rate', 1,
            'from_user_id', v_alice,
            'to_user_id', v_bob
        ))
    );
END;
$outer$;

ROLLBACK;
