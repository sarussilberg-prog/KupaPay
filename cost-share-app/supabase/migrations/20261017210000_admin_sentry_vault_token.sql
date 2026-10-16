-- Admin Sentry proxy: service_role-only Vault lookup for SENTRY_API_TOKEN fallback.
-- Secret name in Vault: sentry_api_token (dev/prod set manually in SQL editor).

CREATE OR REPLACE FUNCTION public.service_sentry_api_token()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT decrypted_secret
    FROM vault.decrypted_secrets
    WHERE name = 'sentry_api_token'
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.service_sentry_api_token() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.service_sentry_api_token() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_sentry_api_token() TO service_role;
