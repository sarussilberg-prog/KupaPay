-- #450 — invite_preview_rate_limits: RLS enabled with no policies (PostgREST exposure risk).
-- Rows are written only by SECURITY DEFINER enforce_invite_preview_rate_limit().

REVOKE ALL ON TABLE public.invite_preview_rate_limits FROM PUBLIC, anon, authenticated;

CREATE POLICY invite_preview_rate_limits_deny_authenticated
    ON public.invite_preview_rate_limits
    AS RESTRICTIVE
    FOR ALL
    TO authenticated
    USING (false)
    WITH CHECK (false);

CREATE POLICY invite_preview_rate_limits_deny_anon
    ON public.invite_preview_rate_limits
    AS RESTRICTIVE
    FOR ALL
    TO anon
    USING (false)
    WITH CHECK (false);
