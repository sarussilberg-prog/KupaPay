-- Renamed from 20261016320000 (version collision with reapply_archive_group). Idempotent REVOKE/GRANT.
-- Round 11 / P1 — handle_revenuecat_webhook must be service_role only (PostgREST RPC).

REVOKE ALL ON FUNCTION public.handle_revenuecat_webhook(
    TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID, BOOLEAN, BOOLEAN, BOOLEAN
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.handle_revenuecat_webhook(
    TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID, BOOLEAN, BOOLEAN, BOOLEAN
) TO service_role;
