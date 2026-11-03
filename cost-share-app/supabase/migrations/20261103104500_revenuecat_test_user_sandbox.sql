-- Allow production RevenueCat webhook to apply SANDBOX events only for flagged test users.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS revenuecat_test_user BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.revenuecat_test_user IS
    'When true, production revenuecat-webhook may apply SANDBOX store events for this user (internal QA).';

CREATE OR REPLACE FUNCTION public.is_revenuecat_test_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT revenuecat_test_user FROM public.profiles WHERE id = p_user_id),
        FALSE
    );
$$;

REVOKE ALL ON FUNCTION public.is_revenuecat_test_user(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_revenuecat_test_user(UUID) TO service_role;
