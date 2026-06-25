-- Run via Supabase MCP execute_sql against dev (drxfbicunusmipdgbgdk). ROLLBACKs.
BEGIN;
SET LOCAL session_replication_role = replica;

ALTER TABLE groups          ENABLE ALWAYS TRIGGER trg_group_activity_events;
ALTER TABLE groups          ENABLE ALWAYS TRIGGER trg_stamp_group_note_updated_at;
ALTER TABLE friend_requests ENABLE ALWAYS TRIGGER trg_friend_request_activity_events;
ALTER TABLE group_members   ENABLE ALWAYS TRIGGER trg_group_membership_activity_events;

DO $outer$
DECLARE
    v_group  CONSTANT UUID := '00000000-0000-0000-0000-0000000bf001';
    v_alice  CONSTANT UUID := '00000000-0000-0000-0000-0000000bfa01';
    v_bob    CONSTANT UUID := '00000000-0000-0000-0000-0000000bfb01';
    v_fr     UUID;
    v_count  INT;
    v_seen   TIMESTAMPTZ;
    v_upd    TIMESTAMPTZ;
BEGIN
    -- seed users + simulate Alice as the auth'd actor
    INSERT INTO auth.users (id) VALUES (v_alice), (v_bob);
    INSERT INTO public.profiles (id, email, name, default_currency, language, is_active, invite_token)
    VALUES (v_alice, 'bf-a@test.local', 'Alice', 'USD', 'en', TRUE, 'tt_bf_a'),
           (v_bob,   'bf-b@test.local', 'Bob',   'USD', 'en', TRUE, 'tt_bf_b');
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_alice::text)::text, true);

    -- CASE 1: group_created → exactly one event for the creator
    INSERT INTO public.groups (id, name, default_currency, created_by, is_active, group_type, invite_token)
    VALUES (v_group, 'BF Group', 'USD', v_alice, TRUE, 'general', 'tt_bf_group');
    SELECT COUNT(*) INTO v_count FROM activity_events WHERE kind = 'group_created' AND group_id = v_group;
    IF v_count <> 1 THEN RAISE EXCEPTION 'Case 1: expected 1 group_created, got %', v_count; END IF;
    PERFORM 1 FROM activity_events WHERE kind = 'group_created' AND user_id = v_alice AND actor_user_id = v_alice;
    IF NOT FOUND THEN RAISE EXCEPTION 'Case 1: group_created actor/user mismatch'; END IF;

    -- members: Alice (founder) + Bob
    INSERT INTO public.group_members (group_id, user_id, is_active, joined_at)
    VALUES (v_group, v_alice, TRUE, now()), (v_group, v_bob, TRUE, now());

    -- CASE 2: note change → event for every active member; note_updated_at stamped;
    --         editor (Alice) auto-marked seen, Bob not.
    UPDATE public.groups SET note = 'hello team' WHERE id = v_group;
    SELECT COUNT(*) INTO v_count FROM activity_events WHERE kind = 'group_note_changed' AND group_id = v_group;
    IF v_count <> 2 THEN RAISE EXCEPTION 'Case 2: expected 2 group_note_changed, got %', v_count; END IF;
    SELECT note_updated_at INTO v_upd FROM groups WHERE id = v_group;
    IF v_upd IS NULL THEN RAISE EXCEPTION 'Case 2: note_updated_at not stamped'; END IF;
    SELECT note_seen_at INTO v_seen FROM group_members WHERE group_id = v_group AND user_id = v_alice;
    IF v_seen IS NULL THEN RAISE EXCEPTION 'Case 2: editor note_seen_at not set'; END IF;
    SELECT note_seen_at INTO v_seen FROM group_members WHERE group_id = v_group AND user_id = v_bob;
    IF v_seen IS NOT NULL THEN RAISE EXCEPTION 'Case 2: non-editor should be unseen'; END IF;

    -- CASE 3: friend rejection → recipient row updated + sender row inserted, both carry responder
    INSERT INTO public.friend_requests (id, from_user_id, to_user_id, status, created_at)
    VALUES (gen_random_uuid(), v_bob, v_alice, 'pending', now())
    RETURNING id INTO v_fr;
    UPDATE public.friend_requests SET status = 'rejected', responded_at = now() WHERE id = v_fr;
    -- recipient (Alice) row + sender (Bob) row = 2 rows for this ref
    SELECT COUNT(*) INTO v_count FROM activity_events
        WHERE kind = 'friend_request_received' AND ref_id = v_fr;
    IF v_count <> 2 THEN RAISE EXCEPTION 'Case 3: expected 2 friend rows, got %', v_count; END IF;
    PERFORM 1 FROM activity_events WHERE ref_id = v_fr AND user_id = v_bob
        AND actor_user_id = v_alice AND metadata->>'status' = 'rejected'
        AND metadata->>'responder_user_id' = v_alice::text;
    IF NOT FOUND THEN RAISE EXCEPTION 'Case 3: sender rejection row missing/incorrect'; END IF;

    -- CASE 4: mark_group_note_seen clears Bob's unread (set jwt to Bob)
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_bob::text)::text, true);
    PERFORM mark_group_note_seen(v_group);
    SELECT note_seen_at INTO v_seen FROM group_members WHERE group_id = v_group AND user_id = v_bob;
    IF v_seen IS NULL OR v_seen < v_upd THEN RAISE EXCEPTION 'Case 4: note_seen_at not advanced'; END IF;

    -- CASE 5: group_deleted → event for every active member, actor = deleter (Alice)
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_alice::text)::text, true);
    UPDATE public.groups SET is_active = false WHERE id = v_group;
    SELECT COUNT(*) INTO v_count FROM activity_events WHERE kind = 'group_deleted' AND group_id = v_group;
    IF v_count <> 2 THEN RAISE EXCEPTION 'Case 5: expected 2 group_deleted, got %', v_count; END IF;
    PERFORM 1 FROM activity_events WHERE kind = 'group_deleted' AND user_id = v_bob AND actor_user_id = v_alice;
    IF NOT FOUND THEN RAISE EXCEPTION 'Case 5: group_deleted actor should be deleter'; END IF;

    RAISE NOTICE 'group_friend_activity_events: ALL CASES PASSED';
END $outer$;

ROLLBACK;
