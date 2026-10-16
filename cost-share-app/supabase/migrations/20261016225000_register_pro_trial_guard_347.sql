-- #347 — Client may only register trial reminder when individual Pro/trial is active server-side.

CREATE OR REPLACE FUNCTION public.register_pro_trial_reminder(p_trial_ends_at TIMESTAMPTZ)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_pro_until TIMESTAMPTZ;
BEGIN
    IF v_uid IS NULL THEN
        RETURN;
    END IF;
    IF NOT public.is_caller_active() THEN
        RAISE EXCEPTION 'inactive_account' USING ERRCODE = '42501';
    END IF;

    IF p_trial_ends_at IS NULL THEN
        UPDATE public.profiles
        SET pro_trial_ends_at = NULL,
            pro_trial_reminder_sent_at = NULL
        WHERE id = v_uid;
        RETURN;
    END IF;

    SELECT pro_until INTO v_pro_until FROM public.profiles WHERE id = v_uid;

    IF v_pro_until IS NULL OR v_pro_until <= NOW() THEN
        RAISE EXCEPTION 'trial_not_eligible' USING ERRCODE = '42501';
    END IF;
    IF p_trial_ends_at <= NOW() OR p_trial_ends_at > NOW() + INTERVAL '16 days' THEN
        RAISE EXCEPTION 'trial_end_out_of_range' USING ERRCODE = '42501';
    END IF;
    IF p_trial_ends_at > v_pro_until + INTERVAL '1 day' THEN
        RAISE EXCEPTION 'trial_end_after_pro_until' USING ERRCODE = '42501';
    END IF;

    UPDATE public.profiles
    SET pro_trial_ends_at = p_trial_ends_at,
        pro_trial_reminder_sent_at = NULL
    WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.register_pro_trial_reminder(TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_pro_trial_reminder(TIMESTAMPTZ) TO authenticated;
