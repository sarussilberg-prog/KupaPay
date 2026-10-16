-- #308 — delete_consolidation_batch restricted to payer or group creator.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_owner CONSTANT UUID := '00000000-0000-0000-0000-000000308001';
    v_alice CONSTANT UUID := '00000000-0000-0000-0000-000000308002';
    v_bob   CONSTANT UUID := '00000000-0000-0000-0000-000000308003';
    v_group CONSTANT UUID := '00000000-0000-0000-0000-000000308010';
    v_batch UUID;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_owner, 'dc308-owner@test.local'),
        (v_alice, 'dc308-alice@test.local'),
        (v_bob,   'dc308-bob@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token) VALUES
        (v_owner, 'Owner', 'ILS', TRUE, 'dc308Owner123'),
        (v_alice, 'Alice', 'ILS', TRUE, 'dc308Alice12'),
        (v_bob,   'Bob',   'ILS', TRUE, 'dc308Bob0123');
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'DC308', 'ILS', TRUE, v_owner, 'dc308Group123');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_owner, TRUE),
        (v_group, v_alice, TRUE),
        (v_group, v_bob, TRUE);

    SET LOCAL session_replication_role = origin;
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

    PERFORM public.test_set_authenticated(v_bob);
    BEGIN
        PERFORM public.delete_consolidation_batch(v_batch);
        RAISE EXCEPTION 'Case A failed: non-payer member must not delete batch';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%not_authorized_or_batch_not_found%'
           AND SQLERRM NOT LIKE '%42501%' THEN
            RAISE;
        END IF;
    END;

    PERFORM public.test_set_authenticated(v_owner);
    PERFORM public.delete_consolidation_batch(v_batch);

    IF EXISTS (
        SELECT 1 FROM public.consolidation_batches WHERE id = v_batch AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Case B failed: group creator must delete batch';
    END IF;
END;
$outer$;

ROLLBACK;
