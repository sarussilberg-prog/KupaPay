-- ============================================================================
-- SQL regression tests for expense_added activity events carrying the
-- recipient's signed viewer_delta (paid − share).
--
-- Run via Supabase MCP:
--   mcp__supabase__execute_sql with the full contents below against the dev
--   project (drxfbicunusmipdgbgdk). The transaction ROLLBACKs at the end so
--   no data persists.
--
-- Mirrors activity_events.test.sql: session_replication_role = replica
-- disables the auth.users FK trigger; we ENABLE ALWAYS the activity triggers
-- under test (the two expense triggers) so they still fire.
-- ============================================================================

BEGIN;

SET LOCAL session_replication_role = replica;

-- Re-enable the triggers under test (replica mode disables them).
ALTER TABLE expenses       ENABLE ALWAYS TRIGGER trg_expense_activity_events;
ALTER TABLE expense_splits ENABLE ALWAYS TRIGGER trg_expense_split_viewer_delta;

DO $outer$
DECLARE
    v_group   CONSTANT UUID := '00000000-0000-0000-0000-0000000ed001';
    v_alice   CONSTANT UUID := '00000000-0000-0000-0000-0000000ed0a1';  -- payer
    v_bob     CONSTANT UUID := '00000000-0000-0000-0000-0000000ed0b1';  -- borrows
    v_carol   CONSTANT UUID := '00000000-0000-0000-0000-0000000ed0c1';  -- paid own share
    v_exp     UUID;
    v_exp1    UUID;
    v_delta_a NUMERIC;
    v_delta_b NUMERIC;
    v_delta_c NUMERIC;
    v_present BOOLEAN;
BEGIN
    -- Force auth.uid() (some branches read it); Alice is the actor.
    PERFORM set_config('request.jwt.claim.sub', v_alice::text, true);

    -- ---- seed ----------------------------------------------------------
    INSERT INTO auth.users (id) VALUES (v_alice), (v_bob), (v_carol);
    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token)
    VALUES
        (v_alice, 'ed-alice@test.local', 'Alice', 'USD', 'en', TRUE, 'tt_ed_alice'),
        (v_bob,   'ed-bob@test.local',   'Bob',   'USD', 'en', TRUE, 'tt_ed_bob'),
        (v_carol, 'ed-carol@test.local', 'Carol', 'USD', 'en', TRUE, 'tt_ed_carol');
    INSERT INTO public.groups (id, name, default_currency, created_by, is_active, group_type, invite_token)
    VALUES (v_group, 'ED Test Group', 'USD', v_alice, TRUE, 'general', 'tt_ed_group');
    INSERT INTO public.group_members (group_id, user_id, is_active, joined_at) VALUES
        (v_group, v_alice, TRUE, now()),
        (v_group, v_bob,   TRUE, now()),
        (v_group, v_carol, TRUE, now());

    -- Alice pays 30. Splits: Alice 10, Bob 10, Carol 10.
    --   Alice: paid 30, share 10 → delta +20  (net creditor)
    --   Bob:   paid  0, share 10 → delta -10  (net debtor)
    --   Carol: paid  0, share 10 → delta -10
    -- To exercise the "= 0" case we make Carol both pay and owe her share by
    -- using a separate expense below; here Bob and Carol are symmetric debtors.
    INSERT INTO public.expenses (group_id, paid_by, amount, currency, description, expense_date, created_by, is_deleted)
    VALUES (v_group, v_alice, 30, 'USD', 'Dinner', CURRENT_DATE, v_alice, FALSE)
    RETURNING id INTO v_exp1;

    -- Splits inserted AFTER the expense (mirrors create_expense_with_splits),
    -- so the split-side trigger is what fills viewer_delta for participants.
    INSERT INTO public.expense_splits (expense_id, user_id, amount) VALUES
        (v_exp1, v_alice, 10),
        (v_exp1, v_bob,   10),
        (v_exp1, v_carol, 10);

    -- ---- CASE 1: payer's row delta > 0 --------------------------------
    SELECT (metadata->>'viewer_delta')::numeric INTO v_delta_a
    FROM activity_events
    WHERE kind = 'expense_added' AND ref_id = v_exp1 AND user_id = v_alice;
    IF v_delta_a IS NULL OR v_delta_a <= 0 THEN
        RAISE EXCEPTION 'Case 1 failed: payer viewer_delta should be > 0, got %', v_delta_a;
    END IF;
    IF v_delta_a <> 20 THEN
        RAISE EXCEPTION 'Case 1 failed: payer viewer_delta should be 20 (30 paid - 10 share), got %', v_delta_a;
    END IF;

    -- ---- CASE 2: non-paying participant's row delta < 0 ---------------
    SELECT (metadata->>'viewer_delta')::numeric INTO v_delta_b
    FROM activity_events
    WHERE kind = 'expense_added' AND ref_id = v_exp1 AND user_id = v_bob;
    IF v_delta_b IS NULL OR v_delta_b >= 0 THEN
        RAISE EXCEPTION 'Case 2 failed: non-paying participant viewer_delta should be < 0, got %', v_delta_b;
    END IF;
    IF v_delta_b <> -10 THEN
        RAISE EXCEPTION 'Case 2 failed: Bob viewer_delta should be -10 (0 paid - 10 share), got %', v_delta_b;
    END IF;

    -- ---- CASE 3: participant who paid exactly their share → delta 0 ----
    -- Second expense: Carol pays 12, and her only split is her own 12.
    INSERT INTO public.expenses (group_id, paid_by, amount, currency, description, expense_date, created_by, is_deleted)
    VALUES (v_group, v_carol, 12, 'USD', 'Solo snack', CURRENT_DATE, v_carol, FALSE)
    RETURNING id INTO v_exp;

    INSERT INTO public.expense_splits (expense_id, user_id, amount) VALUES
        (v_exp, v_carol, 12);

    SELECT (metadata->>'viewer_delta')::numeric INTO v_delta_c
    FROM activity_events
    WHERE kind = 'expense_added' AND ref_id = v_exp AND user_id = v_carol;
    IF v_delta_c IS NULL OR v_delta_c <> 0 THEN
        RAISE EXCEPTION 'Case 3 failed: participant who paid exactly their share should have viewer_delta 0, got %', v_delta_c;
    END IF;

    -- A member of the group who is NOT in the splits (Alice, Bob) still gets a
    -- fan-out row for this second expense (fan-out is per active member), and
    -- since they neither paid nor have a share their delta must be 0.
    SELECT (metadata ? 'viewer_delta'), (metadata->>'viewer_delta')::numeric
      INTO v_present, v_delta_a
    FROM activity_events
    WHERE kind = 'expense_added' AND ref_id = v_exp AND user_id = v_bob;
    IF NOT v_present OR v_delta_a <> 0 THEN
        RAISE EXCEPTION 'Case 3 failed: uninvolved member viewer_delta should be present and 0, got present=% delta=%', v_present, v_delta_a;
    END IF;

    -- ---- CASE 4: payer-only edit self-heals viewer_delta -----------------
    -- Change ONLY paid_by (Alice → Bob), no split change. Bob now paid 30,
    -- owes his 10 share → +20; Alice paid 0, owes 10 → -10.
    UPDATE public.expenses SET paid_by = v_bob WHERE id = v_exp1;

    SELECT (metadata->>'viewer_delta')::numeric INTO v_delta_b
    FROM activity_events WHERE kind = 'expense_added' AND ref_id = v_exp1 AND user_id = v_bob;
    IF v_delta_b IS NULL OR v_delta_b <> 20 THEN
        RAISE EXCEPTION 'Case 4 failed: new payer (Bob) viewer_delta should be 20, got %', v_delta_b;
    END IF;

    SELECT (metadata->>'viewer_delta')::numeric INTO v_delta_a
    FROM activity_events WHERE kind = 'expense_added' AND ref_id = v_exp1 AND user_id = v_alice;
    IF v_delta_a IS NULL OR v_delta_a <> -10 THEN
        RAISE EXCEPTION 'Case 4 failed: former payer (Alice) viewer_delta should be -10, got %', v_delta_a;
    END IF;

    RAISE NOTICE 'All activity_expense_viewer_delta tests passed.';
END
$outer$;

ROLLBACK;
