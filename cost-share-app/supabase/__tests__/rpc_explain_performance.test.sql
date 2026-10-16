-- EXPLAIN + timing guards for hot paths (seeded volume, local SQL CI).
-- Budgets documented in docs/SSOT/PERFORMANCE.md
BEGIN;
SET LOCAL session_replication_role = replica;

DO $perf$
DECLARE
    v_user   CONSTANT UUID := '00000000-0000-0000-0000-0000007777a1';
    v_group  UUID;
    v_i      INT;
    v_plan   TEXT;
    v_start  TIMESTAMPTZ;
    v_ms     DOUBLE PRECISION;
    v_expense_id UUID;
    -- ms budgets (local docker; generous for CI variance)
    c_simplified_ms CONSTANT DOUBLE PRECISION := 800;
    c_archive_ms    CONSTANT DOUBLE PRECISION := 400;
    c_groups_ms     CONSTANT DOUBLE PRECISION := 400;
    c_expenses_ms   CONSTANT DOUBLE PRECISION := 400;
BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_user, 'perf@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token)
        VALUES (v_user, 'Perf User', 'USD', TRUE, 'perf_invite');

    FOR v_i IN 1..5 LOOP
        v_group := ('00000000-0000-0000-0000-0000007777' || lpad(v_i::text, 2, '0'))::uuid;
        INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
            VALUES (v_group, 'Perf G' || v_i, 'USD', TRUE, v_user, 'perf_g' || v_i);
        INSERT INTO public.group_members (group_id, user_id, is_active)
            VALUES (v_group, v_user, TRUE);
    END LOOP;

    -- ~600 expenses across groups (above seq-scan threshold)
    FOR v_i IN 1..600 LOOP
        v_group := ('00000000-0000-0000-0000-0000007777' || lpad(((v_i % 5) + 1)::text, 2, '0'))::uuid;
        v_expense_id := ('00000000-0000-0000-0000-0000007780' || lpad(v_i::text, 4, '0'))::uuid;
        INSERT INTO public.expenses (
            id, group_id, paid_by, amount, currency, description, is_deleted, created_by, expense_date
        ) VALUES (
            v_expense_id, v_group, v_user, 10.00, 'USD', 'perf', FALSE, v_user, CURRENT_DATE
        );
        INSERT INTO public.expense_splits (expense_id, user_id, amount)
            VALUES (v_expense_id, v_user, 10.00);
    END LOOP;

    ANALYZE public.expenses;
    ANALYZE public.expense_splits;
    ANALYZE public.group_members;
    ANALYZE public.groups;

    PERFORM public.test_set_authenticated(v_user);

    -- Simplified debts RPC
    v_start := clock_timestamp();
    PERFORM public.get_user_simplified_inputs(v_user);
    v_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000;
    IF v_ms > c_simplified_ms THEN
        RAISE EXCEPTION 'get_user_simplified_inputs exceeded budget: % ms > % ms', v_ms, c_simplified_ms;
    END IF;

    -- Group list archive hydration RPC (post-render on mobile)
    v_start := clock_timestamp();
    PERFORM public.get_user_groups_archive_state();
    v_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000;
    IF v_ms > c_archive_ms THEN
        RAISE EXCEPTION 'get_user_groups_archive_state exceeded budget: % ms > % ms', v_ms, c_archive_ms;
    END IF;

    -- Groups list path (membership → groups join, mirrors mobile fetchGroups)
    SELECT string_agg("QUERY PLAN", E'\n')
    INTO v_plan
    FROM EXPLAIN (FORMAT TEXT)
    SELECT g.id
    FROM public.group_members gm
    JOIN public.groups g ON g.id = gm.group_id
    WHERE gm.user_id = v_user
      AND gm.is_active = TRUE
      AND g.is_active = TRUE
    ORDER BY g.created_at DESC;
    IF v_plan ILIKE '%Seq Scan on expenses%' THEN
        RAISE EXCEPTION 'groups list plan unexpectedly seq-scans expenses: %', v_plan;
    END IF;

    v_start := clock_timestamp();
    PERFORM 1
    FROM public.group_members gm
    JOIN public.groups g ON g.id = gm.group_id
    WHERE gm.user_id = v_user
      AND gm.is_active = TRUE
      AND g.is_active = TRUE
    ORDER BY g.created_at DESC
    LIMIT 50;
    v_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000;
    IF v_ms > c_groups_ms THEN
        RAISE EXCEPTION 'groups list query exceeded budget: % ms > % ms', v_ms, c_groups_ms;
    END IF;

    -- Expenses list path (single group, mirrors fetchExpenses)
    v_group := '00000000-0000-0000-0000-000000777701'::uuid;
    SELECT string_agg("QUERY PLAN", E'\n')
    INTO v_plan
    FROM EXPLAIN (FORMAT TEXT)
    SELECT e.id
    FROM public.expenses e
    WHERE e.group_id = v_group
      AND e.is_deleted = FALSE
    ORDER BY e.created_at DESC
    LIMIT 200;
    IF v_plan ILIKE '%Seq Scan on expenses%' THEN
        RAISE EXCEPTION 'expenses list plan uses seq scan on expenses: %', v_plan;
    END IF;

    v_start := clock_timestamp();
    PERFORM 1
    FROM public.expenses e
    WHERE e.group_id = v_group
      AND e.is_deleted = FALSE
    ORDER BY e.created_at DESC
    LIMIT 200;
    v_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000;
    IF v_ms > c_expenses_ms THEN
        RAISE EXCEPTION 'expenses list query exceeded budget: % ms > % ms', v_ms, c_expenses_ms;
    END IF;

    RAISE NOTICE 'rpc_explain_performance.test.sql — all checks passed';
END;
$perf$;

ROLLBACK;
