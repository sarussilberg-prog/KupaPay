-- #348 — authenticated must not EXECUTE profile_visible_to_viewer (RLS internal only).
BEGIN;

DO $outer$
BEGIN
    IF has_function_privilege(
        'authenticated',
        'public.profile_visible_to_viewer(uuid)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'Case 1 failed: authenticated must not have EXECUTE on profile_visible_to_viewer';
    END IF;

    RAISE NOTICE 'profile_visible_revoke_execute_348.test.sql — passed';
END;
$outer$;

ROLLBACK;
