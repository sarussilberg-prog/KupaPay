-- Pin search_path on every SECURITY DEFINER in public / app_private (Splinter + CI gate).

DO $sweep$
DECLARE
    r RECORD;
    v_path TEXT;
BEGIN
    FOR r IN
        SELECT
            n.nspname,
            p.proname,
            pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.prosecdef
          AND n.nspname IN ('public', 'app_private')
          AND NOT EXISTS (
                SELECT 1
                FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg(opt)
                WHERE opt LIKE 'search_path=%'
            )
    LOOP
        IF r.nspname = 'app_private' THEN
            v_path := 'app_private, public';
        ELSIF r.proname IN ('generate_invite_token', 'default_email_unsubscribe_token') THEN
            v_path := 'public, extensions';
        ELSE
            v_path := 'public';
        END IF;

        EXECUTE format(
            'ALTER FUNCTION %I.%I(%s) SET search_path = %L',
            r.nspname,
            r.proname,
            r.args,
            v_path
        );
    END LOOP;
END;
$sweep$;
