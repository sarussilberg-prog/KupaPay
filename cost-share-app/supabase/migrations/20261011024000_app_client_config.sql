-- Remote mobile client policy (min supported version + store links). Read via RPC only.

CREATE TABLE IF NOT EXISTS public.app_client_config (
    key        TEXT PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_client_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_client_config (key, value)
VALUES (
    'mobile',
    jsonb_build_object(
        'minSupportedVersion', '1.2.0',
        'iosStoreUrl', 'https://apps.apple.com/us/app/kupapay/id6780216665',
        'androidStoreUrl', 'https://play.google.com/store/apps/details?id=com.kupapay.mobile'
    )
)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.app_client_config IS
    'Server-driven mobile policy. Bump minSupportedVersion when a store release is live (e.g. 2.1.0).';

CREATE OR REPLACE FUNCTION public.get_app_client_config()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT value FROM public.app_client_config WHERE key = 'mobile'),
        '{}'::jsonb
    );
$$;

REVOKE ALL ON FUNCTION public.get_app_client_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_app_client_config() TO anon, authenticated;
