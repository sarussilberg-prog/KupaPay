-- #343 — Inactive (self-deleted) callers must not use group financial RPCs during grace.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_user  CONSTANT UUID := '00000000-0000-0000-0000-000000343001';
    v_group CONSTANT UUID := '00000000-0000-0000-0000-000000343010';
    v_caught BOOLEAN;
    v_rows   INT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_user, 'lock343@test.local');
    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token) VALUES
        (v_user, 'lock343@test.local', 'Deleted', 'USD', 'en', TRUE, 'tt_lock343_u');

    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'Lock343', 'USD', TRUE, v_user, 'tt_lock343_g');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES (v_group, v_user, TRUE);

    INSERT INTO public.expenses (id, group_id, paid_by, amount, currency, description, expense_date, created_by)
        VALUES ('00000000-0000-0000-0000-000000343020', v_group, v_user, 40, 'USD', 'meal', CURRENT_DATE, v_user);

    INSERT INTO public.activity_events (user_id, kind, group_id, ref_id, actor_user_id)
        VALUES (v_user, 'expense_added', v_group, gen_random_uuid(), v_user);

    UPDATE public.profiles SET is_active = FALSE WHERE id = v_user;

    PERFORM public.test_set_authenticated(v_user);

    v_caught := FALSE;
    BEGIN
        PERFORM * FROM public.get_group_pairwise_debts(v_group);
        RAISE EXCEPTION 'Case 1 failed: inactive user must not read pairwise debts';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%not a member of group%' OR SQLERRM LIKE '%42501%' THEN
            v_caught := TRUE;
        ELSE
            RAISE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Case 1 failed: expected membership/active denial';
    END IF;

    v_caught := FALSE;
    BEGIN
        PERFORM * FROM public.get_group_spending_by_category(v_group, 'USD');
        RAISE EXCEPTION 'Case 2 failed: inactive user must not read spending insights';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%not_group_member%' OR SQLERRM LIKE '%42501%' THEN
            v_caught := TRUE;
        ELSE
            RAISE;
        END IF;
    END;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Case 2 failed: expected spending RPC denial';
    END IF;

    SELECT COUNT(*) INTO v_rows FROM public.activity_events WHERE user_id = v_user;
    IF v_rows <> 0 THEN
        RAISE EXCEPTION 'Case 3 failed: inactive user must not SELECT own activity_events (saw %)', v_rows;
    END IF;

    RAISE NOTICE 'deleted_account_rpc_lock_343.test.sql — passed';
END;
$outer$;

ROLLBACK;
