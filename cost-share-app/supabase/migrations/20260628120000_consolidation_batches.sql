-- cost-share-app/supabase/migrations/20260628120000_consolidation_batches.sql

-- ============================================
-- consolidation_batches
-- Groups multiple settlement records that were created together
-- as part of a "convert all currencies" consolidation operation.
-- ============================================

CREATE TABLE consolidation_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    paid_by_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    payment_amount DECIMAL(12, 2) NOT NULL CHECK (payment_amount > 0),
    payment_currency VARCHAR(3) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_consolidation_batches_group ON consolidation_batches(group_id);
CREATE INDEX idx_consolidation_batches_paid_by ON consolidation_batches(paid_by_user_id);
CREATE INDEX idx_consolidation_batches_active ON consolidation_batches(group_id) WHERE deleted_at IS NULL;

-- Add consolidation columns to settlements
ALTER TABLE settlements
    ADD COLUMN consolidation_batch_id UUID REFERENCES consolidation_batches(id) ON DELETE SET NULL,
    ADD COLUMN exchange_rate DECIMAL(18, 8);

CREATE INDEX idx_settlements_batch ON settlements(consolidation_batch_id)
    WHERE consolidation_batch_id IS NOT NULL;

-- ============================================
-- RPC: create_consolidation_batch
-- Atomically creates the batch record + one settlement per currency.
-- Called by the mobile client; no direct table inserts by the client.
-- ============================================

CREATE OR REPLACE FUNCTION create_consolidation_batch(
    p_group_id UUID,
    p_from_user_id UUID,
    p_to_user_id UUID,
    p_payment_currency VARCHAR(3),
    p_payment_amount DECIMAL(12, 2),
    p_settlement_date DATE,
    -- JSON array: [{currency, amount, exchange_rate}]
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
    -- Insert the batch record
    INSERT INTO consolidation_batches (
        group_id, paid_by_user_id, payment_amount, payment_currency
    )
    VALUES (p_group_id, p_from_user_id, p_payment_amount, p_payment_currency)
    RETURNING id INTO v_batch_id;

    -- Insert one settlement per source currency
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_settlements)
    LOOP
        INSERT INTO settlements (
            group_id, from_user_id, to_user_id,
            amount, currency, settlement_date,
            created_by, consolidation_batch_id, exchange_rate
        )
        VALUES (
            p_group_id,
            p_from_user_id,
            p_to_user_id,
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

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION create_consolidation_batch TO authenticated;

-- ============================================
-- RPC: delete_consolidation_batch
-- Soft-deletes the batch and all linked settlements atomically.
-- ============================================

CREATE OR REPLACE FUNCTION delete_consolidation_batch(p_batch_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify caller is a member of the group this batch belongs to
    IF NOT EXISTS (
        SELECT 1 FROM consolidation_batches cb
        JOIN group_members gm ON gm.group_id = cb.group_id
        WHERE cb.id = p_batch_id
          AND cb.deleted_at IS NULL
          AND gm.user_id = auth.uid()
          AND gm.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Not authorized or batch not found';
    END IF;

    UPDATE settlements
        SET deleted_at = NOW()
    WHERE consolidation_batch_id = p_batch_id
      AND deleted_at IS NULL;

    UPDATE consolidation_batches
        SET deleted_at = NOW()
    WHERE id = p_batch_id;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_consolidation_batch TO authenticated;

-- ============================================
-- RLS for consolidation_batches
-- ============================================

ALTER TABLE consolidation_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view active batches in their groups"
    ON consolidation_batches FOR SELECT
    USING (
        deleted_at IS NULL AND
        EXISTS (
            SELECT 1 FROM group_members
            WHERE group_id = consolidation_batches.group_id
              AND user_id = auth.uid()
              AND is_active = TRUE
        )
    );

-- ============================================
-- Activity trigger: one event per batch, not per settlement
-- ============================================

-- Suppress per-settlement activity events for batched settlements
-- (the batch-level trigger fires one consolidation_batch_added event instead)
CREATE OR REPLACE FUNCTION handle_settlement_activity_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_member RECORD;
BEGIN
    -- Skip if this settlement is part of a consolidation batch
    IF NEW.consolidation_batch_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Fire settlement_added for standalone settlements
    FOR v_member IN
        SELECT user_id FROM group_members
        WHERE group_id = NEW.group_id AND is_active = TRUE
    LOOP
        INSERT INTO activity_events (user_id, kind, group_id, ref_id, actor_user_id, metadata)
        VALUES (
            v_member.user_id,
            'settlement_added',
            NEW.group_id,
            NEW.id,
            NEW.created_by,
            jsonb_build_object(
                'from_user_id', NEW.from_user_id,
                'to_user_id', NEW.to_user_id,
                'amount', NEW.amount,
                'currency', NEW.currency
            )
        );
    END LOOP;
    RETURN NEW;
END;
$$;

-- Batch-level activity event trigger on consolidation_batches INSERT
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
                'paid_by_user_id', NEW.paid_by_user_id,
                'payment_amount', NEW.payment_amount,
                'payment_currency', NEW.payment_currency
            )
        );
    END LOOP;
    RETURN NEW;
END;
$$;

CREATE TRIGGER after_consolidation_batch_insert
    AFTER INSERT ON consolidation_batches
    FOR EACH ROW EXECUTE FUNCTION handle_consolidation_batch_activity_event();
