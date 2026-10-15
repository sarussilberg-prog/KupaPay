-- KupaPay Pro v1 (20261011020000+, after #102 + security migrations): profiles.pro_until + group_passes.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS pro_until TIMESTAMPTZ;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS included_trip_pass_credits INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.pro_until IS
    'UTC end of individual Pro subscription (RevenueCat pro entitlement). NULL = never subscribed.';

COMMENT ON COLUMN public.profiles.included_trip_pass_credits IS
    'Redeemable Trip Pass credits from the yearly Pro plan (one granted per yearly purchase/renewal while subscribed).';

CREATE TABLE IF NOT EXISTS public.group_passes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    purchased_by    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    until           TIMESTAMPTZ NOT NULL,
    store_product_id TEXT,
    revenuecat_event_id TEXT,
    pass_source     TEXT NOT NULL DEFAULT 'purchase'
        CHECK (pass_source IN ('purchase', 'included_yearly')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.group_passes
    ADD COLUMN IF NOT EXISTS pass_source TEXT NOT NULL DEFAULT 'purchase';

ALTER TABLE public.group_passes DROP CONSTRAINT IF EXISTS group_passes_pass_source_check;
ALTER TABLE public.group_passes ADD CONSTRAINT group_passes_pass_source_check
    CHECK (pass_source IN ('purchase', 'included_yearly'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_passes_group_id ON public.group_passes(group_id);
CREATE INDEX IF NOT EXISTS idx_group_passes_until ON public.group_passes(until);

CREATE TRIGGER update_group_passes_updated_at
    BEFORE UPDATE ON public.group_passes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.group_passes ENABLE ROW LEVEL SECURITY;

-- Group members can read whether their group has an active pass (for Pro gating UI).
CREATE POLICY "group members read group_passes"
    ON public.group_passes FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = group_passes.group_id
              AND gm.user_id = auth.uid()
              AND gm.is_active = TRUE
        )
    );

-- Writes only via service role (RevenueCat webhook Edge Function).

CREATE OR REPLACE FUNCTION public.has_pro(p_user_id UUID, p_group_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        COALESCE(
            (SELECT pro_until > NOW() FROM public.profiles WHERE id = p_user_id),
            FALSE
        )
        OR (
            p_group_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM public.group_passes gp
                WHERE gp.group_id = p_group_id
                  AND gp.until > NOW()
            )
        );
$$;

REVOKE ALL ON FUNCTION public.has_pro(UUID, UUID) FROM PUBLIC; -- safe-breaking: Pro RPCs authenticated/service-only (#103)
GRANT EXECUTE ON FUNCTION public.has_pro(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_pro(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_pro_status(p_group_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'individualProUntil', (SELECT pro_until FROM public.profiles WHERE id = auth.uid()),
        'groupPassUntil', CASE
            WHEN p_group_id IS NULL THEN NULL
            ELSE (SELECT until FROM public.group_passes WHERE group_id = p_group_id)
        END,
        'includedTripPassCredits', (
            SELECT included_trip_pass_credits FROM public.profiles WHERE id = auth.uid()
        ),
        'hasPro', public.has_pro(auth.uid(), p_group_id)
    );
$$;

-- Webhook-only: grant one included Trip Pass credit on yearly Pro purchase/renewal.
CREATE OR REPLACE FUNCTION public.grant_included_trip_pass_credit(p_user_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.profiles
    SET included_trip_pass_credits = included_trip_pass_credits + 1
    WHERE id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.grant_included_trip_pass_credit(UUID) FROM PUBLIC; -- safe-breaking: Pro RPCs authenticated/service-only (#103)
GRANT EXECUTE ON FUNCTION public.grant_included_trip_pass_credit(UUID) TO service_role;

-- Redeem one included credit while individual Pro is active (yearly perk).
CREATE OR REPLACE FUNCTION public.redeem_included_trip_pass(p_group_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_credits INT;
    v_pro_until TIMESTAMPTZ;
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

    SELECT pro_until, included_trip_pass_credits
    INTO v_pro_until, v_credits
    FROM public.profiles
    WHERE id = v_uid;

    IF v_pro_until IS NULL OR v_pro_until <= NOW() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'subscription_inactive');
    END IF;

    IF v_credits < 1 THEN
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

REVOKE ALL ON FUNCTION public.redeem_included_trip_pass(UUID) FROM PUBLIC; -- safe-breaking: Pro RPCs authenticated/service-only (#103)
GRANT EXECUTE ON FUNCTION public.redeem_included_trip_pass(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_pro_status(UUID) FROM PUBLIC; -- safe-breaking: Pro RPCs authenticated/service-only (#103)
GRANT EXECUTE ON FUNCTION public.get_my_pro_status(UUID) TO authenticated;

-- Paywall / purchase analytics (extends monetization_events).
ALTER TABLE public.monetization_events DROP CONSTRAINT IF EXISTS monetization_events_event_type_check;

ALTER TABLE public.monetization_events ADD CONSTRAINT monetization_events_event_type_check
    CHECK (event_type IN (
        'ad_gate_shown',
        'ad_gate_watch_tapped',
        'ad_gate_watch_completed',
        'ad_gate_pro_tapped',
        'pro_promo_dismissed',
        'remind_sent',
        'paywall_viewed',
        'purchase_started',
        'purchase_completed',
        'purchase_failed',
        'restore_completed',
        'restore_failed'
    ));
