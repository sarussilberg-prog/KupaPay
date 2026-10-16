-- #375 — hard_purge must not enqueue foreign expense-receipts paths.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_attacker CONSTANT UUID := '00000000-0000-0000-0000-000000037501';
    v_victim   CONSTANT UUID := '00000000-0000-0000-0000-000000037502';
    v_group    CONSTANT UUID := '00000000-0000-0000-0000-000000037510';
    v_exp      CONSTANT UUID := '00000000-0000-0000-0000-000000037511';
    v_owned    CONSTANT UUID := '00000000-0000-0000-0000-000000037512';
    v_path     TEXT;
    v_rows     INT;
    v_purged   INT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_attacker, 'rc375-attacker@test.local'),
        (v_victim,   'rc375-victim@test.local');

    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token) VALUES
        (v_attacker, 'rc375-attacker@test.local', 'Attacker', 'USD', 'en', TRUE, 'tt_rc375_atk'),
        (v_victim,   'rc375-victim@test.local',   'Victim',   'USD', 'en', TRUE, 'tt_rc375_vic');

    PERFORM set_config('role', 'service_role', TRUE);

    v_path := public.expense_receipt_object_path_for_user(
        v_attacker,
        v_victim::text || '/receipt.jpg'
    );
    IF v_path IS NOT NULL THEN
        RAISE EXCEPTION 'Case 1 failed: foreign receipt path must normalize to NULL (got %)', v_path;
    END IF;

    v_path := public.expense_receipt_object_path_for_user(
        v_attacker,
        v_attacker::text || '/receipt.jpg'
    );
    IF v_path IS DISTINCT FROM v_attacker::text || '/receipt.jpg' THEN
        RAISE EXCEPTION 'Case 2 failed: owned receipt path expected, got %', v_path;
    END IF;

    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, 'RC375', 'USD', TRUE, v_attacker, 'tt_rc375_grp');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_attacker, TRUE);

    INSERT INTO public.expenses (
        id, group_id, amount, currency, description, expense_date,
        receipt_url, paid_by, created_by, split_mode
    ) VALUES
        (v_exp, v_group, 10, 'USD', 'foreign path', CURRENT_DATE,
            v_victim::text || '/evil.jpg', v_attacker, v_attacker, 'equal'),
        (gen_random_uuid(), v_group, 5, 'USD', 'owned path', CURRENT_DATE,
            v_attacker::text || '/mine.jpg', v_attacker, v_attacker, 'equal');

    PERFORM public.test_set_authenticated(v_attacker);
    PERFORM public.delete_my_account();

    PERFORM set_config('role', 'supabase_admin', TRUE);

    UPDATE public.profiles
        SET deleted_at = NOW() - INTERVAL '31 days'
        WHERE id = v_attacker;
    UPDATE public.account_deletions_audit
        SET deleted_at = NOW() - INTERVAL '31 days'
        WHERE user_id = v_attacker AND restored_at IS NULL;

    PERFORM set_config('role', 'service_role', TRUE);
    SELECT public.hard_purge_expired_deleted_accounts(10) INTO v_purged;
    IF v_purged < 1 THEN
        RAISE EXCEPTION 'Case 3 failed: expected hard purge, got %', v_purged;
    END IF;

    SELECT COUNT(*) INTO v_rows
    FROM public.storage_cleanup_queue
    WHERE bucket = 'expense-receipts'
      AND object_path = v_victim::text || '/evil.jpg';
    IF v_rows <> 0 THEN
        RAISE EXCEPTION 'Case 4 failed: foreign receipt path must not be queued (rows=%)', v_rows;
    END IF;

    SELECT COUNT(*) INTO v_rows
    FROM public.storage_cleanup_queue
    WHERE bucket = 'expense-receipts'
      AND object_path = v_attacker::text || '/mine.jpg';
    IF v_rows <> 1 THEN
        RAISE EXCEPTION 'Case 5 failed: owned receipt path should be queued once (rows=%)', v_rows;
    END IF;

    RAISE NOTICE 'receipt_cleanup_owned_path_375.test.sql — passed';
END;
$outer$;

ROLLBACK;
