-- Fix create_consolidation_batch to store per-debt from/to_user_id
-- so bidirectional debts show the correct direction in history.
-- Each item in p_settlements can now carry from_user_id / to_user_id;
-- falls back to the global p_from/p_to for backward compatibility.

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
        group_id, paid_by_user_id, payment_amount, payment_currency
    )
    VALUES (p_group_id, p_from_user_id, p_payment_amount, p_payment_currency)
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
