-- #394 — Sample demo group for curious users (uses guest members from #395).

CREATE OR REPLACE FUNCTION public.create_demo_group()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_me UUID := auth.uid();
    v_group_id UUID := gen_random_uuid();
    v_guest_a UUID;
    v_guest_b UUID;
    v_exp UUID;
BEGIN
    IF v_me IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.groups AS g
        JOIN public.group_members AS gm ON gm.group_id = g.id
        WHERE gm.user_id = v_me
          AND gm.is_active = TRUE
          AND g.is_active = TRUE
          AND g.name = 'KupaPay demo trip'
    ) THEN
        RETURN json_build_object('ok', FALSE, 'error_code', 'demo_exists');
    END IF;

    INSERT INTO public.groups (id, name, description, created_by, default_currency, group_type)
    VALUES (
        v_group_id,
        'KupaPay demo trip',
        'Sample group — edit or delete anytime.',
        v_me,
        COALESCE((SELECT default_currency FROM public.profiles WHERE id = v_me), 'ILS'),
        'trip'
    );

    INSERT INTO public.group_members (group_id, user_id, is_active)
    VALUES (v_group_id, v_me, TRUE);

    SELECT (public.add_guest_group_member(v_group_id, 'Alex') ->> 'guest_user_id')::uuid INTO v_guest_a;
    SELECT (public.add_guest_group_member(v_group_id, 'Sam') ->> 'guest_user_id')::uuid INTO v_guest_b;

    INSERT INTO public.expenses (
        id, group_id, description, amount, currency, expense_date, paid_by, created_by, category
    )
    VALUES (
        gen_random_uuid(), v_group_id, 'Airbnb (3 nights)', 900.00, 'ILS', CURRENT_DATE - 2, v_me, v_me, 'accommodation'
    )
    RETURNING id INTO v_exp;

    INSERT INTO public.expense_splits (expense_id, user_id, amount)
    VALUES
        (v_exp, v_me, 300),
        (v_exp, v_guest_a, 300),
        (v_exp, v_guest_b, 300);

    INSERT INTO public.expenses (
        id, group_id, description, amount, currency, expense_date, paid_by, created_by, category
    )
    VALUES (
        gen_random_uuid(), v_group_id, 'Groceries', 180.00, 'ILS', CURRENT_DATE - 1, v_guest_a, v_me, 'food'
    )
    RETURNING id INTO v_exp;

    INSERT INTO public.expense_splits (expense_id, user_id, amount)
    VALUES
        (v_exp, v_me, 60),
        (v_exp, v_guest_a, 60),
        (v_exp, v_guest_b, 60);

    RETURN json_build_object('ok', TRUE, 'group_id', v_group_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_demo_group() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_demo_group() TO authenticated;
