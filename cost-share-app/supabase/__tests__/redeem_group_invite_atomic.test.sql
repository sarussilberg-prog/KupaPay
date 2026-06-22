-- ============================================================================
-- Regression test for redeem_group_invite() atomicity fix.
--
-- Bug (Sentry COPAY-MOBILE-PROD-G): concurrent redemptions of the same group
-- invite raced into a duplicate-key violation on
-- group_members_group_id_user_id_key because the body did a non-atomic
-- UPDATE-then-INSERT. The fix replaces it with a single ON CONFLICT upsert.
--
-- This test verifies behaviour is preserved AND that the conflict path updates
-- (rather than throwing) when a membership row already exists:
--   1. New invitee  -> inserts active row, already_member = false
--   2. Re-redeem     -> already_member = true, still exactly one row (no dup)
--   3. Inactive prior member -> ON CONFLICT DO UPDATE reactivates, no error
--
-- True concurrency cannot be reproduced in a single session; the ON CONFLICT
-- clause is what makes the parallel case safe, and case 3 exercises it.
--
-- Run via Supabase MCP (mcp__supabase__execute_sql) against dev
-- drxfbicunusmipdgbgdk. Wrapped in BEGIN/ROLLBACK — no data persists.
-- session_replication_role = replica disables FK + auto-friend triggers but
-- leaves the UNIQUE constraint (index-backed) enforced — exactly what we test.
-- ============================================================================

BEGIN;
SET LOCAL session_replication_role = replica;

DO $outer$
DECLARE
    v_group CONSTANT UUID := '00000000-0000-0000-0000-00000fed0001';
    v_a     CONSTANT UUID := '00000000-0000-0000-0000-00000fed00a1'; -- creator/member
    v_b     CONSTANT UUID := '00000000-0000-0000-0000-00000fed00b2'; -- fresh invitee
    v_c     CONSTANT UUID := '00000000-0000-0000-0000-00000fed00c3'; -- inactive prior member
    v_token CONSTANT TEXT := 'tt_redeem01';
    v_res   JSON;
    v_count INT;
    v_active BOOLEAN;
BEGIN
    INSERT INTO public.profiles (id, name, is_active) VALUES
        (v_a, 'Alice', TRUE), (v_b, 'Bob', TRUE), (v_c, 'Carol', TRUE);

    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, group_type, invite_token)
        VALUES (v_group, 'Redeem Test', 'ILS', TRUE, v_a, 'general', v_token);

    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_a, TRUE),       -- creator
        (v_group, v_c, FALSE);      -- Carol previously left (inactive row exists)

    -- ---- CASE 1: Bob (new) redeems ----
    PERFORM set_config('request.jwt.claim.sub', v_b::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_b::text)::text, true);

    v_res := redeem_group_invite(v_token);
    IF (v_res->>'already_member')::boolean THEN
        RAISE EXCEPTION 'CASE 1 FAIL: expected already_member=false for fresh invitee';
    END IF;
    SELECT count(*), bool_or(is_active) INTO v_count, v_active
        FROM public.group_members WHERE group_id = v_group AND user_id = v_b;
    IF v_count <> 1 OR NOT v_active THEN
        RAISE EXCEPTION 'CASE 1 FAIL: expected 1 active row for Bob, got % rows active=%', v_count, v_active;
    END IF;

    -- ---- CASE 2: Bob re-redeems (the racing call's effect) ----
    v_res := redeem_group_invite(v_token);
    IF NOT (v_res->>'already_member')::boolean THEN
        RAISE EXCEPTION 'CASE 2 FAIL: expected already_member=true on re-redeem';
    END IF;
    SELECT count(*) INTO v_count
        FROM public.group_members WHERE group_id = v_group AND user_id = v_b;
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'CASE 2 FAIL: re-redeem created a duplicate row (% rows)', v_count;
    END IF;

    -- ---- CASE 3: Carol (inactive prior row) redeems -> ON CONFLICT DO UPDATE ----
    PERFORM set_config('request.jwt.claim.sub', v_c::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_c::text)::text, true);

    v_res := redeem_group_invite(v_token);
    IF (v_res->>'already_member')::boolean THEN
        RAISE EXCEPTION 'CASE 3 FAIL: expected already_member=false (was inactive)';
    END IF;
    SELECT count(*), bool_or(is_active) INTO v_count, v_active
        FROM public.group_members WHERE group_id = v_group AND user_id = v_c;
    IF v_count <> 1 OR NOT v_active THEN
        RAISE EXCEPTION 'CASE 3 FAIL: expected Carol reactivated to 1 active row, got % active=%', v_count, v_active;
    END IF;

    RAISE NOTICE 'redeem_group_invite_atomic: ALL CASES PASSED';
END;
$outer$;

ROLLBACK;
