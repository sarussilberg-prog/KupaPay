-- Reassert profiles column GRANTs (PostgREST 42501 when clients use select=* or grants drift).
-- RLS: profiles_select_scoped is maintained in 20261016227000_profile_rls_inline_id_qualify.sql.

REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;

GRANT SELECT (
    id,
    email,
    name,
    phone,
    avatar_url,
    default_currency,
    language,
    is_active,
    created_at,
    updated_at,
    activity_last_seen_at
) ON TABLE public.profiles TO authenticated;

GRANT UPDATE (
    name,
    email,
    phone,
    avatar_url,
    default_currency,
    language,
    updated_at
) ON TABLE public.profiles TO authenticated;
