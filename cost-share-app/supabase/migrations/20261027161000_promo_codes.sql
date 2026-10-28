-- KupaPay-owned promo codes: admin-managed codes, user redeem → profiles.pro_until (+ RC sync via edge).

CREATE TABLE IF NOT EXISTS public.promo_codes (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code           TEXT NOT NULL,
    duration_days  INT NOT NULL CHECK (duration_days >= 1 AND duration_days <= 730),
    max_uses       INT CHECK (max_uses IS NULL OR max_uses >= 1),
    expires_at     TIMESTAMPTZ,
    created_by     UUID NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT promo_codes_code_normalized CHECK (code = upper(btrim(code)) AND length(code) BETWEEN 4 AND 32)
);

CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_code_unique ON public.promo_codes (code);

COMMENT ON TABLE public.promo_codes IS
    'KupaPay promo codes; redeem extends profiles.pro_until. Admin-only via SECURITY DEFINER RPCs.';

CREATE TABLE IF NOT EXISTS public.promo_redemptions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_code_id UUID NOT NULL REFERENCES public.promo_codes (id) ON DELETE RESTRICT,
    user_id       UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    redeemed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    pro_until     TIMESTAMPTZ NOT NULL,
    rc_synced_at  TIMESTAMPTZ,
    rc_sync_error TEXT,
    CONSTRAINT promo_redemptions_one_per_user UNIQUE (promo_code_id, user_id)
);

CREATE INDEX IF NOT EXISTS promo_redemptions_user_id_idx ON public.promo_redemptions (user_id);

COMMENT ON TABLE public.promo_redemptions IS
    'One redemption per user per promo code; pro_until snapshot at redeem time.';

CREATE TABLE IF NOT EXISTS public.promo_redeem_rate_limits (
    user_id        UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    window_start   TIMESTAMPTZ NOT NULL,
    attempt_count  INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, window_start)
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redeem_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.promo_codes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.promo_redemptions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.promo_redeem_rate_limits FROM PUBLIC, anon, authenticated;

CREATE POLICY promo_codes_deny_all ON public.promo_codes AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY promo_codes_deny_anon ON public.promo_codes AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY promo_redemptions_deny_all ON public.promo_redemptions AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY promo_redemptions_deny_anon ON public.promo_redemptions AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY promo_redeem_rate_limits_deny_all ON public.promo_redeem_rate_limits AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY promo_redeem_rate_limits_deny_anon ON public.promo_redeem_rate_limits AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.enforce_promo_redeem_rate_limit(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_window TIMESTAMPTZ := date_trunc('hour', NOW());
    v_count INT;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.promo_redeem_rate_limits (user_id, window_start, attempt_count)
    VALUES (p_user_id, v_window, 1)
    ON CONFLICT (user_id, window_start)
    DO UPDATE SET attempt_count = promo_redeem_rate_limits.attempt_count + 1
    RETURNING attempt_count INTO v_count;

    IF v_count > 15 THEN
        RAISE EXCEPTION 'promo_rate_limit_exceeded' USING ERRCODE = '42501';
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_promo_redeem_rate_limit(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_promo_redeem_rate_limit(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_create_promo_code(
    p_code TEXT,
    p_duration_days INT,
    p_max_uses INT DEFAULT NULL,
    p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_code TEXT;
    v_id UUID;
BEGIN
    IF NOT public.is_app_admin() THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;

    v_code := upper(btrim(COALESCE(p_code, '')));
    IF v_code !~ '^[A-Z0-9][A-Z0-9-]{2,30}[A-Z0-9]$' AND v_code !~ '^[A-Z0-9]{4,32}$' THEN
        RAISE EXCEPTION 'promo_code_invalid_format' USING ERRCODE = '22023';
    END IF;

    IF p_duration_days IS NULL OR p_duration_days < 1 OR p_duration_days > 730 THEN
        RAISE EXCEPTION 'promo_duration_invalid' USING ERRCODE = '22023';
    END IF;

    IF p_max_uses IS NOT NULL AND p_max_uses < 1 THEN
        RAISE EXCEPTION 'promo_max_uses_invalid' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.promo_codes (code, duration_days, max_uses, expires_at, created_by, active)
    VALUES (v_code, p_duration_days, p_max_uses, p_expires_at, auth.uid(), TRUE)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_promo_code(TEXT, INT, INT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_promo_code(TEXT, INT, INT, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_promo_codes()
RETURNS TABLE (
    id UUID,
    code TEXT,
    duration_days INT,
    max_uses INT,
    use_count BIGINT,
    expires_at TIMESTAMPTZ,
    active BOOLEAN,
    created_at TIMESTAMPTZ,
    created_by UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_app_admin() THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        c.id,
        c.code,
        c.duration_days,
        c.max_uses,
        (SELECT COUNT(*)::BIGINT FROM public.promo_redemptions r WHERE r.promo_code_id = c.id) AS use_count,
        c.expires_at,
        c.active,
        c.created_at,
        c.created_by
    FROM public.promo_codes c
    ORDER BY c.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_promo_codes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_promo_codes() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_promo_code_active(p_promo_code_id UUID, p_active BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_app_admin() THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;

    UPDATE public.promo_codes
    SET active = COALESCE(p_active, FALSE)
    WHERE id = p_promo_code_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'promo_not_found' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_promo_code_active(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_promo_code_active(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_code TEXT;
    v_row public.promo_codes%ROWTYPE;
    v_use_count BIGINT;
    v_new_until TIMESTAMPTZ;
    v_current_until TIMESTAMPTZ;
    v_redemption_id UUID;
    v_duration_days INT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
    END IF;

    PERFORM public.enforce_promo_redeem_rate_limit(v_uid);

    v_code := upper(btrim(COALESCE(p_code, '')));
    IF length(v_code) < 4 THEN
        RAISE EXCEPTION 'promo_invalid' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_row
    FROM public.promo_codes
    WHERE code = v_code
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'promo_invalid' USING ERRCODE = 'P0002';
    END IF;

    IF NOT v_row.active THEN
        RAISE EXCEPTION 'promo_inactive' USING ERRCODE = '42501';
    END IF;

    IF v_row.expires_at IS NOT NULL AND v_row.expires_at <= NOW() THEN
        RAISE EXCEPTION 'promo_expired' USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.promo_redemptions
        WHERE promo_code_id = v_row.id AND user_id = v_uid
    ) THEN
        RAISE EXCEPTION 'promo_already_redeemed' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*) INTO v_use_count
    FROM public.promo_redemptions
    WHERE promo_code_id = v_row.id;

    IF v_row.max_uses IS NOT NULL AND v_use_count >= v_row.max_uses THEN
        RAISE EXCEPTION 'promo_max_uses' USING ERRCODE = '42501';
    END IF;

    SELECT pro_until INTO v_current_until FROM public.profiles WHERE id = v_uid;
    v_duration_days := v_row.duration_days;
    v_new_until := GREATEST(COALESCE(v_current_until, NOW()), NOW()) + (v_duration_days || ' days')::INTERVAL;

    UPDATE public.profiles
    SET pro_until = v_new_until
    WHERE id = v_uid;

    INSERT INTO public.promo_redemptions (promo_code_id, user_id, pro_until)
    VALUES (v_row.id, v_uid, v_new_until)
    RETURNING id INTO v_redemption_id;

    RETURN jsonb_build_object(
        'ok', TRUE,
        'redemption_id', v_redemption_id,
        'pro_until', v_new_until,
        'duration_days', v_duration_days
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_promo_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(TEXT) TO authenticated;

-- Edge function RC sync (service_role): mark redemption after RevenueCat promotional grant.
CREATE OR REPLACE FUNCTION public.mark_promo_redemption_rc_synced(
    p_redemption_id UUID,
    p_user_id UUID,
    p_ok BOOLEAN,
    p_error TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.promo_redemptions
    SET
        rc_synced_at = CASE WHEN p_ok THEN NOW() ELSE rc_synced_at END,
        rc_sync_error = CASE WHEN p_ok THEN NULL ELSE left(COALESCE(p_error, 'rc_failed'), 500) END
    WHERE id = p_redemption_id
      AND user_id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_promo_redemption_rc_synced(UUID, UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_promo_redemption_rc_synced(UUID, UUID, BOOLEAN, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.get_promo_redemption_for_rc_sync(
    p_redemption_id UUID,
    p_user_id UUID
)
RETURNS TABLE (duration_days INT, rc_synced_at TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT c.duration_days, r.rc_synced_at
    FROM public.promo_redemptions r
    JOIN public.promo_codes c ON c.id = r.promo_code_id
    WHERE r.id = p_redemption_id
      AND r.user_id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_promo_redemption_for_rc_sync(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_promo_redemption_for_rc_sync(UUID, UUID) TO service_role;
