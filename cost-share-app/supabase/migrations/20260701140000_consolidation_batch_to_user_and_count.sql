-- Add paid_to_user_id and settlement_count to consolidation_batches.
-- paid_to_user_id: the net receiver (so the activity trigger can surface "NAME paid you").
-- settlement_count: number of currency legs, used for "X currencies merged" badge.

ALTER TABLE consolidation_batches
    ADD COLUMN IF NOT EXISTS paid_to_user_id UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS settlement_count SMALLINT NOT NULL DEFAULT 0;

-- ============================================================================
-- Update create_consolidation_batch to store paid_to_user_id + settlement_count
-- ============================================================================

CREATE OR REPLACE FUNCTION create_consolidation_batch(
    p_group_id UUID,
    p_from_user_id UUID,
    p_to_user_id UUID,
    p_payment_currency VARCHAR(3),
    p_payment_amount DECIMAL(12, 2),
    p_settlement_date DATE,
    p_settlements JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_batch_id UUID;
    v_item JSONB;
BEGIN
    INSERT INTO consolidation_batches (
        group_id, paid_by_user_id, paid_to_user_id,
        payment_amount, payment_currency, settlement_count
    )
    VALUES (
        p_group_id,
        p_from_user_id,
        p_to_user_id,
        p_payment_amount,
        p_payment_currency,
        jsonb_array_length(p_settlements)
    )
    RETURNING id INTO v_batch_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_settlements)
    LOOP
        INSERT INTO settlements (
            group_id, from_user_id, to_user_id,
            amount, currency, settlement_date,
            created_by, consolidation_batch_id, exchange_rate
        )
        VALUES (
            p_group_id,
            COALESCE((v_item->>'from_user_id')::UUID, p_from_user_id),
            COALESCE((v_item->>'to_user_id')::UUID, p_to_user_id),
            (v_item->>'amount')::DECIMAL,
            v_item->>'currency',
            p_settlement_date,
            auth.uid(),
            v_batch_id,
            (v_item->>'exchange_rate')::DECIMAL
        );
    END LOOP;

    RETURN v_batch_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_consolidation_batch TO authenticated;

-- ============================================================================
-- Update trigger to include paid_to_user_id and settlement_count in metadata
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_consolidation_batch_activity_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_member RECORD;
BEGIN
    FOR v_member IN
        SELECT user_id FROM group_members
        WHERE group_id = NEW.group_id AND is_active = TRUE
    LOOP
        INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata)
        VALUES (
            v_member.user_id,
            'consolidation_batch_added',
            NEW.group_id,
            NEW.id,
            auth.uid(),
            jsonb_build_object(
                'paid_by_user_id',  NEW.paid_by_user_id,
                'paid_to_user_id',  NEW.paid_to_user_id,
                'payment_amount',   NEW.payment_amount,
                'payment_currency', NEW.payment_currency,
                'settlement_count', NEW.settlement_count
            )
        );
    END LOOP;
    RETURN NEW;
END;
$$;
