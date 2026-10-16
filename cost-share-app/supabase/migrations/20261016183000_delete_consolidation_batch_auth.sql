-- #308 — delete_consolidation_batch: batch payer or group creator only.

CREATE OR REPLACE FUNCTION public.delete_consolidation_batch(p_batch_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
    END IF;
    IF NOT public.is_caller_active() THEN
        RAISE EXCEPTION 'inactive_account' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.consolidation_batches cb
        WHERE cb.id = p_batch_id
          AND cb.deleted_at IS NULL
          AND public.is_group_member(cb.group_id)
          AND (
              cb.paid_by_user_id = v_uid
              OR public.is_group_creator(cb.group_id)
          )
    ) THEN
        RAISE EXCEPTION 'not_authorized_or_batch_not_found' USING ERRCODE = '42501';
    END IF;

    UPDATE public.settlements
        SET deleted_at = NOW()
    WHERE consolidation_batch_id = p_batch_id
      AND deleted_at IS NULL;

    UPDATE public.consolidation_batches
        SET deleted_at = NOW()
    WHERE id = p_batch_id;
END;
$$;
