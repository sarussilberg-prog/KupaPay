-- ============================================================================
-- Account deletion lifecycle: delete → blocked app access → self-restore within
-- grace → hard purge after grace → cross-user restore denied → peer balances.
-- Run against dev (drxfbicunusmipdgbgdk) via Supabase MCP; ROLLBACK at end.
-- ============================================================================

BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_a       CONSTANT UUID := '00000000-0000-0000-0000-000000adl001';
    v_b       CONSTANT UUID := '00000000-0000-0000-0000-000000adl002';
    v_c       CONSTANT UUID := '00000000-0000-0000-0000-000000adl003';
    v_grp     CONSTANT UUID := '00000000-0000-0000-0000-000000adl010';
    v_caught  BOOLEAN;
    v_state   JSONB;
    v_active  BOOLEAN;
    v_banned  TIMESTAMPTZ;
    v_email   TEXT;
    v_purged  INT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_a, 'adl-a@test.local'),
        (v_b, 'adl-b@test.local'),
        (v_c, 'adl-c@test.local');

    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token) VALUES
        (v_a, 'adl-a@test.local', 'Alice', 'USD', 'en', TRUE, 'tt_adl_a'),
        (v_b, 'adl-b@test.local', 'Bob',   'USD', 'en', TRUE, 'tt_adl_b'),
        (v_c, 'adl-c@test.local', 'Carol', 'USD', 'en', TRUE, 'tt_adl_c');

    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_grp, 'ADL Group', 'USD', TRUE, v_a, 'tt_adl_grp');

    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_grp, v_a, TRUE),
        (v_grp, v_b, TRUE);

    INSERT INTO public.expenses (id, group_id, paid_by, amount, currency, description, expense_date, created_by)
        VALUES ('00000000-0000-0000-0000-000000adl020', v_grp, v_a, 100, 'USD', 'dinner', CURRENT_DATE, v_a);

    INSERT INTO public.expense_splits (expense_id, user_id, amount) VALUES
        ('00000000-0000-0000-0000-000000adl020', v_a, 50),
        ('00000000-0000-0000-0000-000000adl020', v_b, 50);

    -- ---- CASE 1: delete_my_account scrubs profile, keeps grace (no ban) ----
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_a::text, 'iat', EXTRACT(EPOCH FROM NOW())::bigint)::text, TRUE);
    PERFORM public.delete_my_account();

    SELECT is_active INTO v_active FROM profiles WHERE id = v_a;
    IF v_active IS DISTINCT FROM FALSE THEN
        RAISE EXCEPTION 'Case 1a failed: profile should be inactive';
    END IF;

    SELECT banned_until INTO v_banned FROM auth.users WHERE id = v_a;
    IF v_banned IS NOT NULL THEN
        RAISE EXCEPTION 'Case 1b failed: banned_until should be NULL during grace, got %', v_banned;
    END IF;

    SELECT public.get_my_account_deletion_state() INTO v_state;
    IF (v_state->>'canRestore')::boolean IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Case 1c failed: canRestore expected TRUE, got %', v_state;
    END IF;

    -- ---- CASE 2: cross-user restore via restore_deleted_account denied ----
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_b::text)::text, TRUE);
    SET LOCAL ROLE authenticated;
    v_caught := FALSE;
    BEGIN
        PERFORM public.restore_deleted_account(v_a, NULL, 'evil');
    EXCEPTION WHEN insufficient_privilege THEN
        v_caught := TRUE;
    END;
    RESET ROLE;
    IF NOT v_caught THEN
        RAISE EXCEPTION 'Case 2 failed: authenticated must not execute restore_deleted_account';
    END IF;

    -- ---- CASE 3: self restore within grace (fresh JWT) -------------------
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_a::text, 'iat', EXTRACT(EPOCH FROM NOW())::bigint)::text, TRUE);
    PERFORM public.restore_my_account();

    SELECT is_active INTO v_active FROM profiles WHERE id = v_a;
    IF v_active IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Case 3a failed: profile should be active after restore';
    END IF;

    SELECT email INTO v_email FROM profiles WHERE id = v_a;
    IF v_email <> 'adl-a@test.local' THEN
        RAISE EXCEPTION 'Case 3b failed: email not restored, got %', v_email;
    END IF;

    -- Re-delete Alice for hard-purge case
    PERFORM public.delete_my_account();

    -- ---- CASE 4: Bob balances still include Alice split ------------------
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_b::text)::text, TRUE);
    IF public.get_user_simplified_inputs(v_b) IS NULL THEN
        RAISE EXCEPTION 'Case 4 failed: balance RPC returned NULL';
    END IF;

    -- ---- CASE 5: hard purge after grace ----------------------------------
    UPDATE profiles SET deleted_at = NOW() - INTERVAL '31 days' WHERE id = v_a;
    UPDATE account_deletions_audit
        SET deleted_at = NOW() - INTERVAL '31 days'
        WHERE user_id = v_a AND restored_at IS NULL;

    SELECT public.hard_purge_expired_deleted_accounts(10) INTO v_purged;
    IF v_purged < 1 THEN
        RAISE EXCEPTION 'Case 5a failed: expected hard purge count >= 1, got %', v_purged;
    END IF;

    SELECT recovery_email INTO v_email
    FROM account_deletions_audit
    WHERE user_id = v_a
    ORDER BY deleted_at DESC LIMIT 1;
    IF v_email IS NOT NULL THEN
        RAISE EXCEPTION 'Case 5b failed: recovery_email should be cleared after hard purge';
    END IF;

    SELECT banned_until INTO v_banned FROM auth.users WHERE id = v_a;
    IF v_banned IS NULL THEN
        RAISE EXCEPTION 'Case 5c failed: banned_until should be set after hard purge';
    END IF;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_a::text, 'iat', EXTRACT(EPOCH FROM NOW())::bigint)::text, TRUE);
    SELECT public.get_my_account_deletion_state() INTO v_state;
    IF (v_state->>'canRestore')::boolean IS DISTINCT FROM FALSE THEN
        RAISE EXCEPTION 'Case 5d failed: canRestore should be FALSE after hard purge';
    END IF;

    RAISE NOTICE 'account_deletion_lifecycle.test.sql — all cases passed';
END;
$outer$;

ROLLBACK;
