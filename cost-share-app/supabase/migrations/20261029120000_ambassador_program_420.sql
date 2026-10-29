-- #420 Ambassador program — applications (manual approve), Pro via profiles.pro_until, tracked referral codes.

CREATE TABLE IF NOT EXISTS public.ambassador_applications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    audience_type   TEXT NOT NULL CHECK (audience_type IN ('travel_creator', 'student_leader')),
    primary_link    TEXT NOT NULL CHECK (length(btrim(primary_link)) BETWEEN 4 AND 512),
    message         TEXT NOT NULL CHECK (length(btrim(message)) BETWEEN 10 AND 2000),
    consent         BOOLEAN NOT NULL DEFAULT FALSE,
    status          TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    reject_reason   TEXT,
    reviewed_at     TIMESTAMPTZ,
    reviewed_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ambassador_applications_one_pending_per_user
    ON public.ambassador_applications (user_id)
    WHERE status = 'pending';

COMMENT ON TABLE public.ambassador_applications IS
    'Ambassador program applications (#420). Approved only via admin_approve_ambassador_application — never auto-granted.';

CREATE INDEX IF NOT EXISTS idx_ambassador_applications_status ON public.ambassador_applications(status);
CREATE INDEX IF NOT EXISTS idx_ambassador_applications_user ON public.ambassador_applications(user_id);

ALTER TABLE public.ambassador_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own ambassador applications"
    ON public.ambassador_applications FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.ambassadors (
    user_id         UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    application_id  UUID NOT NULL UNIQUE REFERENCES public.ambassador_applications(id) ON DELETE RESTRICT,
    referral_code   TEXT NOT NULL,
    pro_until       TIMESTAMPTZ NOT NULL,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ambassadors_referral_code_normalized CHECK (
        referral_code = upper(btrim(referral_code)) AND referral_code ~ '^AMB-[A-Z0-9]{6,8}$'
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS ambassadors_referral_code_unique ON public.ambassadors (referral_code);

COMMENT ON TABLE public.ambassadors IS
    'Approved ambassadors with unique referral codes; Pro entitlement stored on profiles.pro_until at approval time.';

ALTER TABLE public.ambassadors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ambassadors read own row"
    ON public.ambassadors FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.ambassador_referrals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ambassador_user_id  UUID NOT NULL REFERENCES public.ambassadors(user_id) ON DELETE CASCADE,
    referee_user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    referral_code       TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (referee_user_id)
);

CREATE INDEX IF NOT EXISTS idx_ambassador_referrals_ambassador ON public.ambassador_referrals(ambassador_user_id);

ALTER TABLE public.ambassador_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ambassadors read own referral attributions"
    ON public.ambassador_referrals FOR SELECT
    TO authenticated
    USING (
        ambassador_user_id = auth.uid()
        OR referee_user_id = auth.uid()
    );

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS referred_by_ambassador_id UUID REFERENCES public.ambassadors(user_id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public._generate_ambassador_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_code TEXT;
    v_try INT := 0;
BEGIN
    LOOP
        v_try := v_try + 1;
        v_code := 'AMB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.ambassadors WHERE referral_code = v_code);
        IF v_try > 20 THEN
            RAISE EXCEPTION 'ambassador_code_generation_failed';
        END IF;
    END LOOP;
    RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public._generate_ambassador_referral_code() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.submit_ambassador_application(
    p_audience_type TEXT,
    p_primary_link TEXT,
    p_message TEXT,
    p_consent BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_id UUID;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
    END IF;
    IF COALESCE(p_consent, FALSE) IS NOT TRUE THEN
        RAISE EXCEPTION 'consent_required' USING ERRCODE = '22023';
    END IF;
    IF p_audience_type NOT IN ('travel_creator', 'student_leader') THEN
        RAISE EXCEPTION 'invalid_audience_type' USING ERRCODE = '22023';
    END IF;
    IF length(btrim(COALESCE(p_primary_link, ''))) < 4 THEN
        RAISE EXCEPTION 'invalid_primary_link' USING ERRCODE = '22023';
    END IF;
    IF length(btrim(COALESCE(p_message, ''))) < 10 THEN
        RAISE EXCEPTION 'invalid_message' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (SELECT 1 FROM public.ambassadors WHERE user_id = v_uid AND active) THEN
        RAISE EXCEPTION 'already_ambassador' USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.ambassador_applications
        WHERE user_id = v_uid AND status = 'pending'
    ) THEN
        RAISE EXCEPTION 'application_pending' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.ambassador_applications (
        user_id, audience_type, primary_link, message, consent, status
    ) VALUES (
        v_uid, p_audience_type, btrim(p_primary_link), btrim(p_message), TRUE, 'pending'
    )
    RETURNING id INTO v_id;

    RETURN jsonb_build_object('ok', TRUE, 'application_id', v_id, 'status', 'pending');
END;
$$;

REVOKE ALL ON FUNCTION public.submit_ambassador_application(TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_ambassador_application(TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_ambassador_application()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_row public.ambassador_applications%ROWTYPE;
    v_amb public.ambassadors%ROWTYPE;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('authenticated', FALSE);
    END IF;

    SELECT * INTO v_amb FROM public.ambassadors WHERE user_id = v_uid AND active LIMIT 1;
    IF FOUND THEN
        RETURN jsonb_build_object(
            'authenticated', TRUE,
            'is_ambassador', TRUE,
            'referral_code', v_amb.referral_code,
            'pro_until', v_amb.pro_until
        );
    END IF;

    SELECT * INTO v_row
    FROM public.ambassador_applications
    WHERE user_id = v_uid
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('authenticated', TRUE, 'is_ambassador', FALSE, 'application', NULL);
    END IF;

    RETURN jsonb_build_object(
        'authenticated', TRUE,
        'is_ambassador', FALSE,
        'application', jsonb_build_object(
            'id', v_row.id,
            'status', v_row.status,
            'created_at', v_row.created_at,
            'reject_reason', v_row.reject_reason
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_ambassador_application() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_ambassador_application() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_ambassador_applications(p_status TEXT DEFAULT NULL)
RETURNS SETOF public.ambassador_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_app_admin() THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;
    IF p_status IS NULL THEN
        RETURN QUERY SELECT * FROM public.ambassador_applications ORDER BY created_at DESC;
    ELSE
        RETURN QUERY
        SELECT * FROM public.ambassador_applications
        WHERE status = p_status
        ORDER BY created_at DESC;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_ambassador_applications(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_ambassador_applications(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_approve_ambassador_application(
    p_application_id UUID,
    p_pro_duration_days INT DEFAULT 365
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin UUID := auth.uid();
    v_app public.ambassador_applications%ROWTYPE;
    v_code TEXT;
    v_new_until TIMESTAMPTZ;
    v_current_until TIMESTAMPTZ;
    v_days INT;
BEGIN
    IF NOT public.is_app_admin() THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_app
    FROM public.ambassador_applications
    WHERE id = p_application_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'application_not_found' USING ERRCODE = 'P0002';
    END IF;
    IF v_app.status <> 'pending' THEN
        RAISE EXCEPTION 'application_not_pending' USING ERRCODE = '42501';
    END IF;

    v_days := GREATEST(30, LEAST(730, COALESCE(p_pro_duration_days, 365)));

    SELECT pro_until INTO v_current_until FROM public.profiles WHERE id = v_app.user_id;
    v_new_until := GREATEST(COALESCE(v_current_until, NOW()), NOW()) + (v_days || ' days')::INTERVAL;

    UPDATE public.profiles SET pro_until = v_new_until WHERE id = v_app.user_id;

    v_code := public._generate_ambassador_referral_code();

    INSERT INTO public.ambassadors (user_id, application_id, referral_code, pro_until)
    VALUES (v_app.user_id, v_app.id, v_code, v_new_until);

    UPDATE public.ambassador_applications
       SET status = 'approved',
           reviewed_at = NOW(),
           reviewed_by = v_admin
     WHERE id = v_app.id;

    RETURN jsonb_build_object(
        'ok', TRUE,
        'user_id', v_app.user_id,
        'referral_code', v_code,
        'pro_until', v_new_until,
        'duration_days', v_days
    );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_approve_ambassador_application(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_approve_ambassador_application(UUID, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reject_ambassador_application(
    p_application_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin UUID := auth.uid();
    v_app public.ambassador_applications%ROWTYPE;
BEGIN
    IF NOT public.is_app_admin() THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_app FROM public.ambassador_applications WHERE id = p_application_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'application_not_found' USING ERRCODE = 'P0002';
    END IF;
    IF v_app.status <> 'pending' THEN
        RAISE EXCEPTION 'application_not_pending' USING ERRCODE = '42501';
    END IF;

    UPDATE public.ambassador_applications
       SET status = 'rejected',
           reject_reason = NULLIF(btrim(COALESCE(p_reason, '')), ''),
           reviewed_at = NOW(),
           reviewed_by = v_admin
     WHERE id = v_app.id;

    RETURN jsonb_build_object('ok', TRUE, 'application_id', p_application_id, 'status', 'rejected');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reject_ambassador_application(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reject_ambassador_application(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.attribute_ambassador_referral(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_norm TEXT;
    v_amb public.ambassadors%ROWTYPE;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
    END IF;

    v_norm := upper(btrim(COALESCE(p_code, '')));
    IF v_norm !~ '^AMB-[A-Z0-9]{6,8}$' THEN
        RAISE EXCEPTION 'invalid_referral_code' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_amb FROM public.ambassadors WHERE referral_code = v_norm AND active LIMIT 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'referral_code_not_found' USING ERRCODE = 'P0002';
    END IF;

    IF v_amb.user_id = v_uid THEN
        RAISE EXCEPTION 'cannot_self_refer' USING ERRCODE = '42501';
    END IF;

    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND referred_by_ambassador_id IS NOT NULL) THEN
        RETURN jsonb_build_object('ok', TRUE, 'already_attributed', TRUE);
    END IF;

    IF EXISTS (SELECT 1 FROM public.ambassador_referrals WHERE referee_user_id = v_uid) THEN
        RETURN jsonb_build_object('ok', TRUE, 'already_attributed', TRUE);
    END IF;

    UPDATE public.profiles
       SET referred_by_ambassador_id = v_amb.user_id
     WHERE id = v_uid AND referred_by_ambassador_id IS NULL;

    INSERT INTO public.ambassador_referrals (ambassador_user_id, referee_user_id, referral_code)
    VALUES (v_amb.user_id, v_uid, v_norm)
    ON CONFLICT (referee_user_id) DO NOTHING;

    RETURN jsonb_build_object(
        'ok', TRUE,
        'already_attributed', FALSE,
        'ambassador_user_id', v_amb.user_id,
        'referral_code', v_norm
    );
END;
$$;

REVOKE ALL ON FUNCTION public.attribute_ambassador_referral(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attribute_ambassador_referral(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_ambassador_referral_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_amb public.ambassadors%ROWTYPE;
    v_count BIGINT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_amb FROM public.ambassadors WHERE user_id = v_uid AND active LIMIT 1;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('is_ambassador', FALSE);
    END IF;

    SELECT COUNT(*) INTO v_count FROM public.ambassador_referrals WHERE ambassador_user_id = v_uid;

    RETURN jsonb_build_object(
        'is_ambassador', TRUE,
        'referral_code', v_amb.referral_code,
        'referral_count', v_count,
        'pro_until', v_amb.pro_until
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_ambassador_referral_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_ambassador_referral_stats() TO authenticated;
