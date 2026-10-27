-- #395 guest placeholder members: add, split footprint, claim merges to joiner.

BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_group CONSTANT UUID := '00000000-0000-0000-0000-000000003950';
    v_alice CONSTANT UUID := '00000000-0000-0000-0000-000000003951';
    v_bob CONSTANT UUID := '00000000-0000-0000-0000-000000003952';
    v_token CONSTANT TEXT := 'tt_guest3951';
    v_guest_id UUID;
    v_expense_id UUID;
    v_bob_owed NUMERIC;
BEGIN
    INSERT INTO public.profiles (id, name, is_active, invite_token) VALUES
        (v_alice, 'Alice', TRUE, 'it_guest395_alice'),
        (v_bob, 'Bob', TRUE, 'it_guest395_bob');

    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, group_type, invite_token)
    VALUES (v_group, 'Guest test', 'ILS', TRUE, v_alice, 'general', v_token);

    INSERT INTO public.group_members (group_id, user_id, is_active)
    VALUES (v_group, v_alice, TRUE);

    PERFORM set_config('request.jwt.claim.sub', v_alice::text, TRUE);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_alice::text)::text, TRUE);

    SELECT (public.add_guest_group_member(v_group, 'Charlie') ->> 'guest_user_id')::uuid
    INTO v_guest_id;

    INSERT INTO public.expenses (
        id, group_id, description, amount, currency, expense_date, paid_by, created_by
    )
    VALUES (
        gen_random_uuid(), v_group, 'Dinner', 100.00, 'ILS', CURRENT_DATE, v_alice, v_alice
    )
    RETURNING id INTO v_expense_id;

    INSERT INTO public.expense_splits (expense_id, user_id, amount)
    VALUES
        (v_expense_id, v_alice, 50.00),
        (v_expense_id, v_guest_id, 50.00);

    PERFORM set_config('request.jwt.claim.sub', v_bob::text, TRUE);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_bob::text)::text, TRUE);

    PERFORM public.redeem_group_invite(v_token);
    PERFORM public.claim_guest_group_member(v_group, v_guest_id);

    SELECT es.amount INTO v_bob_owed
    FROM public.expense_splits AS es
    WHERE es.expense_id = v_expense_id
      AND es.user_id = v_bob;

    IF v_bob_owed IS NULL OR v_bob_owed <> 50.00 THEN
        RAISE EXCEPTION 'expected Bob to inherit 50 split, got %', v_bob_owed;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = v_group AND user_id = v_guest_id AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'guest membership should be inactive after claim';
    END IF;
END $outer$;

ROLLBACK;
