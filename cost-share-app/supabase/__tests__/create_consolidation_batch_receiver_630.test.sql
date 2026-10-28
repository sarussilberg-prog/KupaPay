-- #630 — Receiver can record a consolidation batch (friend owes caller);
-- a member who is neither payer nor receiver is still rejected.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_alice CONSTANT UUID := '00000000-0000-0000-0000-000000630001';
    v_bob   CONSTANT UUID := '00000000-0000-0000-0000-000000630002';
    v_carol CONSTANT UUID := '00000000-0000-0000-0000-000000630003';
    v_group CONSTANT UUID := '00000000-0000-0000-0000-000000630010';
    v_batch UUID;
    v_count INT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_alice, 'cb630-alice@test.local'),
        (v_bob,   'cb630-bob@test.local'),
        (v_carol, 'cb630-carol@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token) VALUES
        (v_alice, 'Alice', 'ILS', TRUE, 'cb630Alice12'),
        (v_bob,   'Bob',   'ILS', TRUE, 'cb630Bob0123'),
        (v_carol, 'Carol', 'ILS', TRUE, 'cb630Carol12');
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'CB630', 'ILS', TRUE, v_alice, 'cb630Group123');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_alice, TRUE),
        (v_group, v_bob, TRUE),
        (v_group, v_carol, TRUE);

    SET LOCAL session_replication_role = origin;

    -- Case A: Alice is the receiver (Bob owes Alice) — must succeed.
    PERFORM public.test_set_authenticated(v_alice);
    v_batch := public.create_consolidation_batch(
        v_group, v_bob, v_alice, 'ILS', 10, CURRENT_DATE,
        jsonb_build_array(jsonb_build_object(
            'currency', 'ILS', 'amount', 10, 'exchange_rate', 1,
            'from_user_id', v_bob, 'to_user_id', v_alice
        ))
    );
    IF v_batch IS NULL THEN
        RAISE EXCEPTION 'Case A failed: receiver batch returned null';
    END IF;
    SELECT count(*) INTO v_count FROM public.settlements
     WHERE consolidation_batch_id = v_batch AND from_user_id = v_bob AND to_user_id = v_alice;
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'Case A failed: expected 1 settlement Bob->Alice, got %', v_count;
    END IF;

    -- Case B: Carol (member, not a party) cannot record Bob->Alice.
    PERFORM public.test_set_authenticated(v_carol);
    BEGIN
        PERFORM public.create_consolidation_batch(
            v_group, v_bob, v_alice, 'ILS', 10, CURRENT_DATE,
            jsonb_build_array(jsonb_build_object(
                'currency', 'ILS', 'amount', 10, 'exchange_rate', 1,
                'from_user_id', v_bob, 'to_user_id', v_alice
            ))
        );
        RAISE EXCEPTION 'Case B failed: non-party member must be rejected';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;
    END;

    RAISE NOTICE 'create_consolidation_batch_receiver_630.test.sql — passed';
END;
$outer$;

ROLLBACK;
