-- Align included Trip Pass redemption with has_pro() (admin force_pro + profiles.pro_until).
CREATE OR REPLACE FUNCTION public.redeem_included_trip_pass(p_group_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_credits INT;
    v_until TIMESTAMPTZ;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = p_group_id
          AND gm.user_id = v_uid
          AND gm.is_active = TRUE
    ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'not_a_member');
    END IF;

    IF NOT public.has_pro(v_uid, NULL) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'subscription_inactive');
    END IF;

    SELECT included_trip_pass_credits INTO v_credits FROM public.profiles WHERE id = v_uid;

    IF v_credits IS NULL OR v_credits < 1 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'no_credit');
    END IF;

    v_until := NOW() + INTERVAL '30 days';

    INSERT INTO public.group_passes (
        group_id, purchased_by, until, store_product_id, pass_source
    )
    VALUES (
        p_group_id, v_uid, v_until, 'included_yearly', 'included_yearly'
    )
    ON CONFLICT (group_id) DO UPDATE SET
        purchased_by = EXCLUDED.purchased_by,
        until = GREATEST(public.group_passes.until, EXCLUDED.until),
        store_product_id = EXCLUDED.store_product_id,
        pass_source = EXCLUDED.pass_source,
        updated_at = NOW();

    UPDATE public.profiles
    SET included_trip_pass_credits = included_trip_pass_credits - 1
    WHERE id = v_uid AND included_trip_pass_credits > 0;

    RETURN jsonb_build_object('ok', true, 'groupPassUntil', v_until);
END;
$$;
