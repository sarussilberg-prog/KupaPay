-- #296 — Receipt OCR quota: fixed server cap; no client-controlled p_max.

DROP FUNCTION IF EXISTS public.consume_receipt_ocr_quota(INT);

CREATE OR REPLACE FUNCTION public.consume_receipt_ocr_quota_for_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_day DATE := (timezone('utc', now()))::date;
    v_count INT;
    v_max CONSTANT INT := 60;
BEGIN
    IF p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    INSERT INTO public.receipt_ocr_daily_usage (user_id, usage_day, call_count)
    VALUES (p_user_id, v_day, 1)
    ON CONFLICT (user_id, usage_day)
    DO UPDATE SET call_count = public.receipt_ocr_daily_usage.call_count + 1
    RETURNING call_count INTO v_count;

    RETURN v_count <= v_max;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_receipt_ocr_quota_for_user(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_receipt_ocr_quota_for_user(UUID) TO service_role;
