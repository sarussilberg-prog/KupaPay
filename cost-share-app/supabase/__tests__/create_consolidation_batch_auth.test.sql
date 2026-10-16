-- #265 — Non-members cannot forge consolidation batches / settlements.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_alice   CONSTANT UUID := '00000000-0000-0000-0000-000000cb2601';
    v_bob     CONSTANT UUID := '00000000-0000-0000-0000-000000cb2602';
    v_group   CONSTANT UUID := '00000000-0000-0000-0000-000000cb2610';
    v_other   CONSTANT UUID := '00000000-0000-0000-0000-000000cb2611';
    v_batch   UUID;
    v_count   INT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_alice, 'cb-alice@test.local'),
        (v_bob,   'cb-bob@test.local'),
        (v_other, 'cb-other@test.local');

    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token) VALUES
        (v_alice, 'Alice', 'ILS', TRUE, 'cbAliceTok12'),
        (v_bob,   'Bob',   'ILS', TRUE, 'cbBobTok0123'),
        (v_other, 'Other', 'ILS', TRUE, 'cbOtherTok12');

    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'CB auth', 'ILS', TRUE, v_alice, 'cbGrpAuth0123');

    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_alice, TRUE),
        (v_group, v_bob,   TRUE);

    PERFORM public.test_set_authenticated(v_other);

    BEGIN
        PERFORM public.create_consolidation_batch(
            v_group,
            v_other,
            v_bob,
            'ILS',
            10,
            CURRENT_DATE,
            jsonb_build_array(jsonb_build_object(
                'currency', 'ILS',
                'amount', 10,
                'exchange_rate', 1,
                'from_user_id', v_other,
                'to_user_id', v_bob
            ))
        );
        RAISE EXCEPTION 'Case A failed: outsider must not create batch';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%not_group_member%'
           AND SQLERRM NOT LIKE '%payer_must_be_caller%'
           AND SQLERRM NOT LIKE '%42501%' THEN
            RAISE;
        END IF;
    END;

    PERFORM public.test_set_authenticated(v_alice);

    v_batch := public.create_consolidation_batch(
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

    IF v_batch IS NULL THEN
        RAISE EXCEPTION 'Case B failed: member create returned null batch id';
    END IF;

    SELECT COUNT(*)::INT INTO v_count
    FROM public.settlements
    WHERE consolidation_batch_id = v_batch AND deleted_at IS NULL;

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'Case B failed: expected 1 settlement, got %', v_count;
    END IF;
END;
$outer$;

ROLLBACK;
