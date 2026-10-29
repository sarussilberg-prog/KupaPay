-- #630 — Profile "Settle all with <person>" returned 403 (payer_must_be_caller)
-- whenever the friend owed the caller: the cross-group plan sends the friend as
-- p_from_user_id. Allow the caller to be either party of the batch; every leg
-- must still involve the caller (#295).

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
    v_uid UUID := auth.uid();
    v_from UUID;
    v_to UUID;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
    END IF;
    IF NOT public.is_group_member(p_group_id) THEN
        RAISE EXCEPTION 'not_group_member' USING ERRCODE = '42501';
    END IF;
    IF NOT public.is_caller_active() THEN
        RAISE EXCEPTION 'inactive_account' USING ERRCODE = '42501';
    END IF;
    -- #630: the caller may be the net payer OR the net receiver (e.g. a friend
    -- owes me and I record "settle all" from my Profile). Outsiders stay rejected.
    IF p_from_user_id IS DISTINCT FROM v_uid AND p_to_user_id IS DISTINCT FROM v_uid THEN
        RAISE EXCEPTION 'caller_must_be_party' USING ERRCODE = '42501';
    END IF;
    IF p_settlements IS NULL
        OR jsonb_typeof(p_settlements) <> 'array'
        OR jsonb_array_length(p_settlements) < 1 THEN
        RAISE EXCEPTION 'settlements_required';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = p_group_id
          AND user_id = p_to_user_id
          AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'recipient_not_group_member';
    END IF;

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
        v_from := COALESCE((v_item->>'from_user_id')::UUID, p_from_user_id);
        v_to := COALESCE((v_item->>'to_user_id')::UUID, p_to_user_id);

        IF v_uid IS DISTINCT FROM v_from AND v_uid IS DISTINCT FROM v_to THEN
            RAISE EXCEPTION 'settlement_leg_must_involve_caller' USING ERRCODE = '42501';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM group_members
            WHERE group_id = p_group_id AND user_id = v_from AND is_active = TRUE
        ) OR NOT EXISTS (
            SELECT 1 FROM group_members
            WHERE group_id = p_group_id AND user_id = v_to AND is_active = TRUE
        ) THEN
            RAISE EXCEPTION 'settlement_party_not_group_member';
        END IF;

        INSERT INTO settlements (
            group_id, from_user_id, to_user_id,
            amount, currency, settlement_date,
            created_by, consolidation_batch_id, exchange_rate
        )
        VALUES (
            p_group_id,
            v_from,
            v_to,
            (v_item->>'amount')::DECIMAL,
            v_item->>'currency',
            p_settlement_date,
            v_uid,
            v_batch_id,
            (v_item->>'exchange_rate')::DECIMAL
        );
    END LOOP;

    RETURN v_batch_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_consolidation_batch TO authenticated;
