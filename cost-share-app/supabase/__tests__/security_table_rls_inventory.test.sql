-- Inventory: every public table has RLS; anon + cross-user reads on per-user tables.
BEGIN;
SET LOCAL session_replication_role = replica;

DO $inv$
DECLARE
    v_a CONSTANT UUID := '00000000-0000-0000-0000-000000b00101';
    v_b CONSTANT UUID := '00000000-0000-0000-0000-000000b00102';
    v_out CONSTANT UUID := '00000000-0000-0000-0000-000000b00199';
    r RECORD;
    v_missing TEXT := '';
    v_seen INT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES
        (v_a, 'sec-inv-a@test.local'),
        (v_b, 'sec-inv-b@test.local');
    INSERT INTO public.profiles (id, name, default_currency, is_active, invite_token) VALUES
        (v_a, 'Sec A', 'USD', TRUE, 'secInvA1234567'),
        (v_b, 'Sec B', 'USD', TRUE, 'secInvB1234567');

    INSERT INTO public.email_lifecycle_deliveries (user_id, template)
        VALUES (v_a, 'welcome');
    INSERT INTO public.weekly_digest_deliveries (user_id, week_start)
        VALUES (v_a, DATE '2026-01-05');
    INSERT INTO public.referral_rewards (referrer_id, referee_id, status)
        VALUES (v_a, v_b, 'pending');
    INSERT INTO public.notification_preferences (user_id) VALUES (v_a);

    SET LOCAL session_replication_role = origin;

    FOR r IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND NOT c.relrowsecurity
        ORDER BY 1
    LOOP
        v_missing := v_missing || r.relname || ', ';
    END LOOP;
    IF v_missing <> '' THEN
        RAISE EXCEPTION 'public tables without RLS: %', v_missing;
    END IF;

    PERFORM set_config('role', 'anon', TRUE);
    FOR r IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND has_table_privilege('anon', c.oid, 'SELECT')
          AND c.relname <> 'legal_documents'
        ORDER BY 1
    LOOP
        BEGIN
            EXECUTE format('SELECT COUNT(*) FROM public.%I', r.relname) INTO v_seen;
            IF v_seen > 0 THEN
                RAISE EXCEPTION 'anon readable rows on public.% (count=%)', r.relname, v_seen;
            END IF;
        EXCEPTION
            WHEN insufficient_privilege THEN
                NULL;
        END;
    END LOOP;

    PERFORM public.test_set_authenticated(v_b);
    SELECT COUNT(*) INTO v_seen FROM public.email_lifecycle_deliveries;
    IF v_seen <> 0 THEN
        RAISE EXCEPTION 'cross-user email_lifecycle_deliveries: expected 0, got %', v_seen;
    END IF;
    SELECT COUNT(*) INTO v_seen FROM public.weekly_digest_deliveries;
    IF v_seen <> 0 THEN
        RAISE EXCEPTION 'cross-user weekly_digest_deliveries: expected 0, got %', v_seen;
    END IF;
    SELECT COUNT(*) INTO v_seen FROM public.referral_rewards WHERE referrer_id = v_a;
    IF v_seen <> 0 THEN
        RAISE EXCEPTION 'cross-user referral_rewards: expected 0, got %', v_seen;
    END IF;

    RAISE NOTICE 'security_table_rls_inventory.test.sql — passed';
END;
$inv$;

ROLLBACK;
