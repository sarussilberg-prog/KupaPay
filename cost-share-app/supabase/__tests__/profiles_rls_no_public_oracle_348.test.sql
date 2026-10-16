-- #348 — profiles_select_scoped must not call public.profile_visible_to_viewer (no EXECUTE for authenticated).
-- Same regression as group_members_insert_friends_only + PostgREST profiles 42501.
BEGIN;

DO $outer$
DECLARE
    v_qual TEXT;
BEGIN
    SELECT pg_get_expr(polqual, polrelid) INTO v_qual
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'profiles'
      AND p.polname = 'profiles_select_scoped';

    IF v_qual IS NULL THEN
        RAISE EXCEPTION 'Case 1 failed: profiles_select_scoped policy missing';
    END IF;

    IF v_qual ILIKE '%profile_visible_to_viewer%' THEN
        RAISE EXCEPTION 'Case 2 failed: policy must not call public.profile_visible_to_viewer (got %)', v_qual;
    END IF;

    IF has_function_privilege(
        'authenticated',
        'public.profile_visible_to_viewer(uuid)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'Case 3 failed: authenticated must not EXECUTE public.profile_visible_to_viewer';
    END IF;

    IF NOT has_function_privilege(
        'authenticated',
        'app_private.profile_peer_visible_for_rls(uuid)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'Case 4 failed: authenticated needs EXECUTE on app_private.profile_peer_visible_for_rls for RLS';
    END IF;

    RAISE NOTICE 'profiles_rls_no_public_oracle_348.test.sql — passed';
END;
$outer$;

ROLLBACK;
