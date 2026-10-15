-- Pro free-trial reminder: client registers trial end; cron invokes pro-trial-reminder-dispatch.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS pro_trial_ends_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS pro_trial_reminder_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.pro_trial_ends_at IS
    'UTC end of App Store / Play free trial (from RevenueCat). NULL when not in trial.';
COMMENT ON COLUMN public.profiles.pro_trial_reminder_sent_at IS
    'When server push reminder was sent (2 days before pro_trial_ends_at).';

CREATE OR REPLACE FUNCTION public.register_pro_trial_reminder(p_trial_ends_at TIMESTAMPTZ)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN;
    END IF;
    IF p_trial_ends_at IS NULL THEN
        UPDATE public.profiles
        SET pro_trial_ends_at = NULL,
            pro_trial_reminder_sent_at = NULL
        WHERE id = auth.uid();
        RETURN;
    END IF;
    UPDATE public.profiles
    SET pro_trial_ends_at = p_trial_ends_at,
        pro_trial_reminder_sent_at = NULL
    WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.register_pro_trial_reminder(TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_pro_trial_reminder(TIMESTAMPTZ) TO authenticated;
