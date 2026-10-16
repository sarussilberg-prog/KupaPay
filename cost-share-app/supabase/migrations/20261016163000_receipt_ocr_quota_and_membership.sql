-- #268 / #269 — Postgres-backed receipt OCR quota; revoke cross-user membership oracle.

CREATE TABLE IF NOT EXISTS public.receipt_ocr_daily_usage (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    usage_day DATE NOT NULL,
    call_count INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, usage_day)
);

ALTER TABLE public.receipt_ocr_daily_usage ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_receipt_ocr_quota(p_max INT DEFAULT 60)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_day DATE := (timezone('utc', now()))::date;
    v_count INT;
BEGIN
    IF v_uid IS NULL THEN
        RETURN FALSE;
    END IF;

    INSERT INTO public.receipt_ocr_daily_usage (user_id, usage_day, call_count)
    VALUES (v_uid, v_day, 1)
    ON CONFLICT (user_id, usage_day)
    DO UPDATE SET call_count = public.receipt_ocr_daily_usage.call_count + 1
    RETURNING call_count INTO v_count;

    RETURN v_count <= GREATEST(p_max, 1);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_receipt_ocr_quota(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_receipt_ocr_quota(INT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_active_group_member(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_group_member(UUID, UUID) TO service_role;
