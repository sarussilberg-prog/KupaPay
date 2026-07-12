-- ============================================================================
-- SQL regression tests for activity_group_last_seen + per-group unread RPCs.
--
-- Run via Supabase MCP:
--   mcp__supabase__execute_sql with the full contents below against the dev
--   project (drxfbicunusmipdgbgdk). The transaction ROLLBACKs at the end so
--   no data persists.
--
-- session_replication_role = replica disables the auth.users trigger and FK
-- checks so we can seed synthetic users. The activity_events triggers must be
-- re-enabled explicitly because we rely on them to fan out an expense into
-- activity_events rows that the unread count then reads.
-- ============================================================================

BEGIN;

SET LOCAL session_replication_role = replica;

ALTER TABLE expenses      ENABLE ALWAYS TRIGGER trg_expense_activity_events;
ALTER TABLE group_members ENABLE ALWAYS TRIGGER trg_group_membership_activity_events;

DO $outer$
DECLARE
    -- Hex-only UUIDs (a95 = "activity group seen" mnemonic).
    v_group1  CONSTANT UUID := '00000000-0000-0000-0000-00000000a951';
    v_group2  CONSTANT UUID := '00000000-0000-0000-0000-00000000a952';
    v_alice   CONSTANT UUID := '00000000-0000-0000-0000-0000000a95a1';
    v_bob     CONSTANT UUID := '00000000-0000-0000-0000-0000000a95b1';
    v_count   INT;
    v_unread1 INT;
    v_unread2 INT;
    v_seen    TIMESTAMPTZ;
BEGIN
    -- ---- seed ----------------------------------------------------------
    INSERT INTO auth.users (id) VALUES (v_alice), (v_bob);
    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token)
    VALUES
        (v_alice, 'ags-alice@test.local', 'Alice', 'USD', 'en', TRUE, 'tt_ags_alice'),
        (v_bob,   'ags-bob@test.local',   'Bob',   'USD', 'en', TRUE, 'tt_ags_bob');
    -- Global watermark set BETWEEN the (backdated) membership joins and the
    -- (now) expenses. activity_events.created_at defaults to now() = the
    -- transaction start, and the group-membership trigger stamps group_added
    -- rows with created_at = joined_at. Seeding joins an hour ago and the
    -- watermark 30 min ago means the group_added events are already "seen"
    -- (before the watermark) while the expenses (at now()) are "new". This lets
    -- each group read exactly 1 unread (the other member's expense), which is
    -- impossible with an epoch watermark because every event in one transaction
    -- otherwise shares the same now() timestamp.
    UPDATE public.profiles SET activity_last_seen_at = now() - interval '30 minutes' WHERE id = v_alice;

    INSERT INTO public.groups (id, name, default_currency, created_by, is_active, group_type, invite_token)
    VALUES
        (v_group1, 'AGS Group 1', 'USD', v_bob, TRUE, 'general', 'tt_ags_g1'),
        (v_group2, 'AGS Group 2', 'USD', v_bob, TRUE, 'general', 'tt_ags_g2');

    -- Bob is founder; add Alice + Bob as active members of both groups.
    -- Backdate joined_at 1h so the resulting group_added events (stamped with
    -- created_at = joined_at) fall BEFORE Alice's watermark and are not counted
    -- as unread — only the later expenses (below) should count.
    INSERT INTO public.group_members (group_id, user_id, is_active, joined_at, added_by)
    VALUES
        (v_group1, v_bob,   TRUE, now() - interval '1 hour', NULL),
        (v_group1, v_alice, TRUE, now() - interval '1 hour', v_bob),
        (v_group2, v_bob,   TRUE, now() - interval '1 hour', NULL),
        (v_group2, v_alice, TRUE, now() - interval '1 hour', v_bob);

    -- Bob adds one expense in each group → each fans out to an
    -- expense_added row for Alice with actor_user_id = Bob (counts as unread).
    INSERT INTO public.expenses (group_id, paid_by, amount, currency, description, expense_date, created_by, is_deleted)
    VALUES (v_group1, v_bob, 10, 'USD', 'G1 lunch', CURRENT_DATE, v_bob, FALSE);
    INSERT INTO public.expenses (group_id, paid_by, amount, currency, description, expense_date, created_by, is_deleted)
    VALUES (v_group2, v_bob, 20, 'USD', 'G2 lunch', CURRENT_DATE, v_bob, FALSE);

    -- Alice self-adds an expense in group1 → actor = Alice, must NOT count.
    INSERT INTO public.expenses (group_id, paid_by, amount, currency, description, expense_date, created_by, is_deleted)
    VALUES (v_group1, v_alice, 5, 'USD', 'Alice own', CURRENT_DATE, v_alice, FALSE);

    -- Act as Alice for auth.uid().
    PERFORM set_config('request.jwt.claim.sub', v_alice::text, true);

    -- ---- CASE 1: get_group_unread_counts returns a row per group with unread>0
    SELECT unread INTO v_unread1 FROM get_group_unread_counts() WHERE group_id = v_group1;
    SELECT unread INTO v_unread2 FROM get_group_unread_counts() WHERE group_id = v_group2;
    IF v_unread1 <> 1 THEN
        RAISE EXCEPTION 'Case 1 failed: expected 1 unread in group1 (Bob''s expense only), got %', v_unread1;
    END IF;
    IF v_unread2 <> 1 THEN
        RAISE EXCEPTION 'Case 1 failed: expected 1 unread in group2, got %', v_unread2;
    END IF;

    -- ---- CASE 2: own actions are not counted (group1 has 2 events for Alice:
    --             Bob''s expense + Alice''s own expense; only Bob''s counts).
    SELECT COUNT(*) INTO v_count FROM activity_events
    WHERE user_id = v_alice AND group_id = v_group1 AND kind = 'expense_added';
    IF v_count <> 2 THEN
        RAISE EXCEPTION 'Case 2 setup wrong: expected 2 expense_added rows for Alice in group1, got %', v_count;
    END IF;
    IF v_unread1 <> 1 THEN
        RAISE EXCEPTION 'Case 2 failed: own expense leaked into unread (unread=%, total=%)', v_unread1, v_count;
    END IF;

    -- ---- CASE 3: mark_group_activity_seen(group1) upserts seen_at ~ now(),
    --             clearing group1''s unread while group2 is untouched.
    PERFORM mark_group_activity_seen(v_group1);

    SELECT seen_at INTO v_seen FROM activity_group_last_seen
    WHERE user_id = v_alice AND group_id = v_group1;
    IF v_seen IS NULL OR v_seen < now() - interval '1 minute' THEN
        RAISE EXCEPTION 'Case 3 failed: seen_at not set to ~now() (%)', v_seen;
    END IF;

    v_unread1 := NULL;
    SELECT unread INTO v_unread1 FROM get_group_unread_counts() WHERE group_id = v_group1;
    IF COALESCE(v_unread1, 0) <> 0 THEN
        RAISE EXCEPTION 'Case 3 failed: group1 unread not cleared after mark seen, got %', v_unread1;
    END IF;

    SELECT unread INTO v_unread2 FROM get_group_unread_counts() WHERE group_id = v_group2;
    IF v_unread2 <> 1 THEN
        RAISE EXCEPTION 'Case 3 failed: group2 unread changed unexpectedly, got %', v_unread2;
    END IF;

    -- ---- CASE 4: idempotent upsert — calling mark again keeps a single row.
    PERFORM mark_group_activity_seen(v_group1);
    SELECT COUNT(*) INTO v_count FROM activity_group_last_seen
    WHERE user_id = v_alice AND group_id = v_group1;
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'Case 4 failed: expected 1 last_seen row after 2 marks, got %', v_count;
    END IF;

    -- ---- CASE 5: anti-flood — a group with NO last_seen row inherits the
    --             GLOBAL watermark. Advance Alice''s global watermark past all
    --             events; group2 (never marked) must then read 0 unread.
    UPDATE public.profiles SET activity_last_seen_at = now() WHERE id = v_alice;
    v_unread2 := NULL;
    SELECT unread INTO v_unread2 FROM get_group_unread_counts() WHERE group_id = v_group2;
    IF COALESCE(v_unread2, 0) <> 0 THEN
        RAISE EXCEPTION 'Case 5 failed: never-opened group did not inherit global watermark, got %', v_unread2;
    END IF;

    RAISE NOTICE 'All activity_group_last_seen tests passed.';
END
$outer$;

ROLLBACK;
