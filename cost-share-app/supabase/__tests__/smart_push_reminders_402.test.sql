-- #402 smart push reminders: schema, permissions, RLS
BEGIN;
SET LOCAL session_replication_role = replica;

DO $schema$
BEGIN
    IF to_regprocedure('public.run_retention_unsettled_nudges(integer)') IS NULL THEN
        RAISE EXCEPTION 'run_retention_unsettled_nudges missing';
    END IF;
    IF to_regprocedure('public.list_deferred_push_deliveries(integer)') IS NULL THEN
        RAISE EXCEPTION 'list_deferred_push_deliveries missing';
    END IF;
    IF to_regprocedure('public.count_push_sent_last_24h(uuid)') IS NULL THEN
        RAISE EXCEPTION 'count_push_sent_last_24h missing';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'notification_preferences'
          AND column_name = 'reminders_push'
    ) THEN
        RAISE EXCEPTION 'notification_preferences.reminders_push missing';
    END IF;
END;
$schema$;

DO $rls$
DECLARE
    v_debtor CONSTANT UUID := '00000000-0000-0000-0000-000000040201';
    v_cred   CONSTANT UUID := '00000000-0000-0000-0000-000000040202';
    v_group  CONSTANT UUID := '00000000-0000-0000-0000-000000040210';
    v_seen   INT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_debtor, '402-debtor@test.local'),
        (v_cred, '402-cred@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token) VALUES
        (v_debtor, 'Debtor', 'ILS', TRUE, '402Debtor123456'),
        (v_cred, 'Creditor', 'ILS', TRUE, '402Creditor1234');
    INSERT INTO public.groups (id, name, default_currency, is_active, created_by, invite_token)
        VALUES (v_group, '402 group', 'ILS', TRUE, v_cred, '402Group123456');
    INSERT INTO public.group_members (group_id, user_id, is_active) VALUES
        (v_group, v_debtor, TRUE),
        (v_group, v_cred, TRUE);

    INSERT INTO public.retention_unsettled_nudge_state (
        user_id, group_id, creditor_user_id, currency, first_unsettled_at
    ) VALUES (v_debtor, v_group, v_cred, 'ILS', NOW() - INTERVAL '30 days');

    SET LOCAL session_replication_role = origin;

    PERFORM public.test_set_authenticated(v_cred);
    SELECT COUNT(*) INTO v_seen FROM public.retention_unsettled_nudge_state;
    IF v_seen <> 0 THEN
        RAISE EXCEPTION 'Case 1 failed: cross-user retention nudge state visible (count=%)', v_seen;
    END IF;

    PERFORM public.test_set_authenticated(v_debtor);
    SELECT COUNT(*) INTO v_seen FROM public.retention_unsettled_nudge_state;
    IF v_seen <> 1 THEN
        RAISE EXCEPTION 'Case 2 failed: debtor should read own nudge state (count=%)', v_seen;
    END IF;

    BEGIN
        PERFORM public.run_retention_unsettled_nudges(1);
        RAISE EXCEPTION 'Case 3 failed: authenticated must not execute run_retention_unsettled_nudges';
    EXCEPTION
        WHEN insufficient_privilege THEN
            NULL;
    END;

    RAISE NOTICE 'smart_push_reminders_402.test.sql — passed';
END;
$rls$;

ROLLBACK;
