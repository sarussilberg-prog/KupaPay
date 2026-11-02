-- RevenueCat webhook: sandbox filter (edge env), event ordering, refund/cancel semantics, trip-pass upsert.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS revenuecat_last_event_ms BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.revenuecat_webhook_events
    ADD COLUMN IF NOT EXISTS event_timestamp_ms BIGINT;

DROP FUNCTION IF EXISTS public.handle_revenuecat_webhook(
    TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID, BOOLEAN, BOOLEAN, BOOLEAN
);

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
    p_is_immediate_pro_revoke BOOLEAN,
    p_is_trip_pass_revoke BOOLEAN,
    p_event_timestamp_ms BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_last_ms BIGINT;
    v_group_id UUID;
    v_intent_group UUID;
    v_credit_granted BOOLEAN := FALSE;
BEGIN
    INSERT INTO public.revenuecat_webhook_events (event_id, user_id, event_type, event_timestamp_ms)
    VALUES (p_event_id, p_user_id, p_event_type, p_event_timestamp_ms)
    ON CONFLICT (event_id) DO NOTHING;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('duplicate', true, 'action', 'ignored');
    END IF;

    SELECT revenuecat_last_event_ms INTO v_last_ms
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF p_event_timestamp_ms IS NOT NULL AND p_event_timestamp_ms < COALESCE(v_last_ms, 0) THEN
        UPDATE public.revenuecat_webhook_events SET action = 'stale_ignored' WHERE event_id = p_event_id;
        RETURN jsonb_build_object('duplicate', false, 'action', 'ignored', 'stale', true);
    END IF;

    IF p_is_trip_pass_revoke THEN
        UPDATE public.group_passes gp
        SET until = LEAST(gp.until, NOW()), updated_at = NOW()
        WHERE gp.until > NOW()
          AND (
              gp.revenuecat_event_id = p_event_id
              OR (p_attr_group_id IS NOT NULL AND gp.group_id = p_attr_group_id AND gp.purchased_by = p_user_id)
          );

        UPDATE public.unassigned_trip_passes utp
        SET until = LEAST(utp.until, NOW())
        WHERE utp.user_id = p_user_id
          AND utp.until > NOW()
          AND utp.revenuecat_event_id = p_event_id;

        IF p_event_timestamp_ms IS NOT NULL THEN
            UPDATE public.profiles
            SET revenuecat_last_event_ms = GREATEST(revenuecat_last_event_ms, p_event_timestamp_ms)
            WHERE id = p_user_id;
        END IF;

        UPDATE public.revenuecat_webhook_events SET action = 'trip_pass_revoke' WHERE event_id = p_event_id;
        RETURN jsonb_build_object('duplicate', false, 'action', 'trip_pass');
    END IF;

    IF p_is_immediate_pro_revoke THEN
        UPDATE public.profiles
        SET pro_until = LEAST(COALESCE(pro_until, NOW()), NOW()),
            revenuecat_last_event_ms = CASE
                WHEN p_event_timestamp_ms IS NULL THEN revenuecat_last_event_ms
                ELSE GREATEST(revenuecat_last_event_ms, p_event_timestamp_ms)
            END
        WHERE id = p_user_id;

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
            ON CONFLICT (group_id) DO UPDATE SET
                until = GREATEST(public.group_passes.until, EXCLUDED.until),
                purchased_by = EXCLUDED.purchased_by,
                store_product_id = EXCLUDED.store_product_id,
                revenuecat_event_id = EXCLUDED.revenuecat_event_id,
                pass_source = EXCLUDED.pass_source,
                updated_at = NOW();

            DELETE FROM public.trip_pass_purchase_intents WHERE user_id = p_user_id;

            IF p_event_timestamp_ms IS NOT NULL THEN
                UPDATE public.profiles
                SET revenuecat_last_event_ms = GREATEST(revenuecat_last_event_ms, p_event_timestamp_ms)
                WHERE id = p_user_id;
            END IF;

            UPDATE public.revenuecat_webhook_events SET action = 'trip_pass' WHERE event_id = p_event_id;
            RETURN jsonb_build_object('duplicate', false, 'action', 'trip_pass', 'groupId', v_group_id);
        END IF;

        INSERT INTO public.unassigned_trip_passes (user_id, revenuecat_event_id, until)
        VALUES (p_user_id, p_event_id, p_trip_pass_until)
        ON CONFLICT (revenuecat_event_id) DO UPDATE SET
            until = GREATEST(public.unassigned_trip_passes.until, EXCLUDED.until);

        DELETE FROM public.trip_pass_purchase_intents WHERE user_id = p_user_id;

        IF p_event_timestamp_ms IS NOT NULL THEN
            UPDATE public.profiles
            SET revenuecat_last_event_ms = GREATEST(revenuecat_last_event_ms, p_event_timestamp_ms)
            WHERE id = p_user_id;
        END IF;

        UPDATE public.revenuecat_webhook_events SET action = 'trip_pass_unassigned' WHERE event_id = p_event_id;
        RETURN jsonb_build_object('duplicate', false, 'action', 'trip_pass_unassigned');
    END IF;

    IF p_pro_until IS NOT NULL THEN
        UPDATE public.profiles
        SET pro_until = CASE
                WHEN p_event_type = 'CANCELLATION' THEN LEAST(COALESCE(pro_until, p_pro_until), p_pro_until)
                ELSE p_pro_until
            END,
            revenuecat_last_event_ms = CASE
                WHEN p_event_timestamp_ms IS NULL THEN revenuecat_last_event_ms
                ELSE GREATEST(revenuecat_last_event_ms, p_event_timestamp_ms)
            END
        WHERE id = p_user_id;

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

REVOKE ALL ON FUNCTION public.handle_revenuecat_webhook(
    TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BIGINT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.handle_revenuecat_webhook(
    TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BIGINT
) TO service_role;
