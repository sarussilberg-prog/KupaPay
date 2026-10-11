-- Pro follow-up (20261011022000): webhook idempotency, capped yearly Trip Pass credits, Trip Pass group binding.

CREATE TABLE IF NOT EXISTS public.revenuecat_webhook_events (
    event_id    TEXT PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_type  TEXT NOT NULL,
    action      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revenuecat_webhook_events_user
    ON public.revenuecat_webhook_events(user_id, created_at DESC);

ALTER TABLE public.revenuecat_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies: service role only (webhook).

CREATE TABLE IF NOT EXISTS public.trip_pass_purchase_intents (
    user_id     UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    group_id    UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.trip_pass_purchase_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own trip pass intent"
    ON public.trip_pass_purchase_intents FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.unassigned_trip_passes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    revenuecat_event_id TEXT NOT NULL UNIQUE,
    until               TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unassigned_trip_passes_user
    ON public.unassigned_trip_passes(user_id, created_at DESC);

ALTER TABLE public.unassigned_trip_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own unassigned trip passes"
    ON public.unassigned_trip_passes FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_passes_revenuecat_event_id
    ON public.group_passes(revenuecat_event_id)
    WHERE revenuecat_event_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_active_group_member(p_user_id UUID, p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = p_group_id
          AND gm.user_id = p_user_id
          AND gm.is_active = TRUE
    );
$$;

REVOKE ALL ON FUNCTION public.is_active_group_member(UUID, UUID) FROM PUBLIC; -- safe-breaking: Pro RPCs authenticated/service-only (#103)
GRANT EXECUTE ON FUNCTION public.is_active_group_member(UUID, UUID) TO authenticated, service_role;

-- At most one unredeemed included credit (skip grant when already 1).
CREATE OR REPLACE FUNCTION public.grant_included_trip_pass_credit(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.profiles
    SET included_trip_pass_credits = 1
    WHERE id = p_user_id
      AND included_trip_pass_credits < 1;
    RETURN FOUND;
END;
$$;

-- Client registers intended group before Trip Pass checkout (membership enforced).
CREATE OR REPLACE FUNCTION public.register_trip_pass_purchase_intent(p_group_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
    END IF;
    IF NOT public.is_active_group_member(v_uid, p_group_id) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'not_a_member');
    END IF;

    INSERT INTO public.trip_pass_purchase_intents (user_id, group_id, expires_at)
    VALUES (v_uid, p_group_id, NOW() + INTERVAL '2 hours')
    ON CONFLICT (user_id) DO UPDATE SET
        group_id = EXCLUDED.group_id,
        created_at = NOW(),
        expires_at = EXCLUDED.expires_at;

    RETURN jsonb_build_object('ok', true, 'groupId', p_group_id);
END;
$$;

REVOKE ALL ON FUNCTION public.register_trip_pass_purchase_intent(UUID) FROM PUBLIC; -- safe-breaking: Pro RPCs authenticated/service-only (#103)
GRANT EXECUTE ON FUNCTION public.register_trip_pass_purchase_intent(UUID) TO authenticated;

-- Apply a purchased Trip Pass to a group when webhook could not bind (or user picks later).
CREATE OR REPLACE FUNCTION public.assign_purchased_trip_pass(p_group_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_row public.unassigned_trip_passes%ROWTYPE;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
    END IF;
    IF NOT public.is_active_group_member(v_uid, p_group_id) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'not_a_member');
    END IF;

    SELECT * INTO v_row
    FROM public.unassigned_trip_passes
    WHERE user_id = v_uid
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'no_unassigned_pass');
    END IF;

    INSERT INTO public.group_passes (
        group_id, purchased_by, until, store_product_id, revenuecat_event_id, pass_source
    )
    VALUES (
        p_group_id, v_uid, v_row.until, 'kupapay_trip_pass', v_row.revenuecat_event_id, 'purchase'
    )
    ON CONFLICT (group_id) DO UPDATE SET
        purchased_by = EXCLUDED.purchased_by,
        until = GREATEST(public.group_passes.until, EXCLUDED.until),
        store_product_id = EXCLUDED.store_product_id,
        revenuecat_event_id = EXCLUDED.revenuecat_event_id,
        pass_source = EXCLUDED.pass_source,
        updated_at = NOW();

    DELETE FROM public.unassigned_trip_passes WHERE id = v_row.id;

    RETURN jsonb_build_object('ok', true, 'groupPassUntil', v_row.until);
END;
$$;

REVOKE ALL ON FUNCTION public.assign_purchased_trip_pass(UUID) FROM PUBLIC; -- safe-breaking: Pro RPCs authenticated/service-only (#103)
GRANT EXECUTE ON FUNCTION public.assign_purchased_trip_pass(UUID) TO authenticated;

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
        'unassignedTripPassCount', (
            SELECT COUNT(*)::INT FROM public.unassigned_trip_passes WHERE user_id = auth.uid()
        ),
        'hasPro', public.has_pro(auth.uid(), p_group_id)
    );
$$;

-- Webhook entry: idempotent by RevenueCat event id.
CREATE OR REPLACE FUNCTION public.handle_revenuecat_webhook(
    p_event_id TEXT,
    p_user_id UUID,
    p_event_type TEXT,
    p_product_id TEXT,
    p_pro_until TIMESTAMPTZ,
    p_trip_pass_until TIMESTAMPTZ,
    p_attr_group_id UUID,
    p_is_trip_pass BOOLEAN,
    p_is_yearly BOOLEAN,
    p_is_revoke BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_inserted BOOLEAN := FALSE;
    v_group_id UUID;
    v_intent_group UUID;
    v_credit_granted BOOLEAN := FALSE;
BEGIN
    INSERT INTO public.revenuecat_webhook_events (event_id, user_id, event_type)
    VALUES (p_event_id, p_user_id, p_event_type)
    ON CONFLICT (event_id) DO NOTHING;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('duplicate', true, 'action', 'ignored');
    END IF;

    IF p_is_revoke AND p_pro_until IS NOT NULL THEN
        UPDATE public.profiles SET pro_until = p_pro_until WHERE id = p_user_id;
        UPDATE public.revenuecat_webhook_events SET action = 'individual_revoke' WHERE event_id = p_event_id;
        RETURN jsonb_build_object('duplicate', false, 'action', 'individual');
    END IF;

    IF p_is_trip_pass AND p_trip_pass_until IS NOT NULL THEN
        SELECT t.group_id INTO v_intent_group
        FROM public.trip_pass_purchase_intents t
        WHERE t.user_id = p_user_id
          AND t.expires_at > NOW()
        ORDER BY t.created_at DESC
        LIMIT 1;

        v_group_id := v_intent_group;

        IF v_group_id IS NULL AND p_attr_group_id IS NOT NULL
           AND public.is_active_group_member(p_user_id, p_attr_group_id) THEN
            v_group_id := p_attr_group_id;
        END IF;

        IF v_group_id IS NOT NULL
           AND public.is_active_group_member(p_user_id, v_group_id) THEN
            INSERT INTO public.group_passes (
                group_id, purchased_by, until, store_product_id, revenuecat_event_id, pass_source
            )
            VALUES (
                v_group_id, p_user_id, p_trip_pass_until, 'kupapay_trip_pass', p_event_id, 'purchase'
            )
            ON CONFLICT (revenuecat_event_id) WHERE revenuecat_event_id IS NOT NULL DO NOTHING;

            DELETE FROM public.trip_pass_purchase_intents WHERE user_id = p_user_id;
            UPDATE public.revenuecat_webhook_events SET action = 'trip_pass' WHERE event_id = p_event_id;
            RETURN jsonb_build_object('duplicate', false, 'action', 'trip_pass', 'groupId', v_group_id);
        END IF;

        INSERT INTO public.unassigned_trip_passes (user_id, revenuecat_event_id, until)
        VALUES (p_user_id, p_event_id, p_trip_pass_until)
        ON CONFLICT (revenuecat_event_id) DO NOTHING;

        DELETE FROM public.trip_pass_purchase_intents WHERE user_id = p_user_id;
        UPDATE public.revenuecat_webhook_events SET action = 'trip_pass_unassigned' WHERE event_id = p_event_id;
        RETURN jsonb_build_object('duplicate', false, 'action', 'trip_pass_unassigned');
    END IF;

    IF p_pro_until IS NOT NULL THEN
        UPDATE public.profiles SET pro_until = p_pro_until WHERE id = p_user_id;

        IF p_is_yearly THEN
            SELECT public.grant_included_trip_pass_credit(p_user_id) INTO v_credit_granted;
            UPDATE public.revenuecat_webhook_events
            SET action = CASE WHEN v_credit_granted THEN 'yearly_credit' ELSE 'individual' END
            WHERE event_id = p_event_id;
            RETURN jsonb_build_object(
                'duplicate', false,
                'action', CASE WHEN v_credit_granted THEN 'yearly_credit' ELSE 'individual' END
            );
        END IF;

        UPDATE public.revenuecat_webhook_events SET action = 'individual' WHERE event_id = p_event_id;
        RETURN jsonb_build_object('duplicate', false, 'action', 'individual');
    END IF;

    UPDATE public.revenuecat_webhook_events SET action = 'ignored' WHERE event_id = p_event_id;
    RETURN jsonb_build_object('duplicate', false, 'action', 'ignored');
END;
$$;

REVOKE ALL ON FUNCTION public.handle_revenuecat_webhook( -- safe-breaking: Pro RPCs authenticated/service-only (#103)
    TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID, BOOLEAN, BOOLEAN, BOOLEAN
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_revenuecat_webhook(
    TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID, BOOLEAN, BOOLEAN, BOOLEAN
) TO service_role;
