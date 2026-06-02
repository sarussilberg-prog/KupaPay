-- =============================================================================
-- 20260602150000_lockdown_security_definer.sql
-- Restrict anonymous (anon) execution of SECURITY DEFINER RPCs.
--
-- Background (KI-006): Supabase advisor (get_advisors security) flagged 17
-- SECURITY DEFINER functions on prod as `anon_security_definer_function_executable`.
-- Most rely on `auth.uid()` and have internal auth checks, but the cleanest fix
-- is to remove `anon` execute entirely so /rest/v1/rpc/<fn> returns 401 before
-- the function runs. Trigger-only functions (emit_*, check_email_not_deleted)
-- need no execute grant — SECURITY DEFINER lets the trigger fire under the
-- function owner's privileges, independent of the calling user.
--
-- This migration is intentionally surgical:
--   * Does NOT touch is_group_member / is_group_creator / is_caller_active —
--     they are RLS helpers that must remain callable by anon (matches the
--     existing pattern in schema.sql lines 202–205, 706–707).
--   * Does NOT touch is_app_admin — already revoked from PUBLIC and granted
--     only to authenticated (schema.sql line 1101–1102).
--   * Trigger functions get a full REVOKE (PUBLIC + anon + authenticated)
--     mirroring the pattern in group-archive.sql lines 360–363.
--
-- Idempotent: REVOKE / GRANT are state-based.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. User-facing RPCs that rely on auth.uid() — lock to authenticated only.
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_open_balances() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_open_balances() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_user_dashboard(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_user_dashboard(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_user_balance_summary(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_user_balance_summary(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_activity_unread_count() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_activity_unread_count() TO authenticated;

-- get_group_messages has a signature drift between dev (3-param incl. p_before) and
-- prod (2-param). Apply REVOKE/GRANT to whichever overload(s) actually exist.
DO $do$
DECLARE
    fn_args TEXT;
BEGIN
    FOR fn_args IN
        SELECT pg_get_function_identity_arguments(p.oid)
        FROM pg_proc p
        WHERE p.pronamespace = 'public'::regnamespace
          AND p.proname = 'get_group_messages'
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION public.get_group_messages(%s) FROM PUBLIC, anon', fn_args);
        EXECUTE format('GRANT  EXECUTE ON FUNCTION public.get_group_messages(%s) TO authenticated', fn_args);
    END LOOP;
END
$do$;

REVOKE EXECUTE ON FUNCTION public.create_group_message(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_group_message(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_group_message(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_group_message(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_group_message(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.delete_group_message(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.accept_friend_request(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.accept_friend_request(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.reject_friend_request(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.reject_friend_request(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.send_friend_request(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.send_friend_request(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.remove_friend(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.remove_friend(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.search_users(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.search_users(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.mark_activity_seen() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.mark_activity_seen() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Admin RPCs — already check is_app_admin() internally; lock execute to
--    authenticated so unauthenticated probes get 401, not a SQL-level "not
--    authorized" error.
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.admin_list_deleted_accounts() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_list_deleted_accounts() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_restore_deleted_account(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_restore_deleted_account(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.restore_deleted_account(uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.restore_deleted_account(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Trigger-only functions — never called as RPCs. Full revoke; triggers
--    still fire because SECURITY DEFINER runs under the function owner.
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.emit_expense_activity_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_settlement_activity_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_friend_request_activity_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_group_membership_activity_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_message_activity_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_email_not_deleted() FROM PUBLIC, anon, authenticated;
