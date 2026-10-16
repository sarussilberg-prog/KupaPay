-- #401 — Public expense share link with OG preview at /e/<share_token>.

ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS share_token TEXT;

UPDATE public.expenses
SET share_token = public.generate_invite_token()
WHERE share_token IS NULL;

ALTER TABLE public.expenses
    ALTER COLUMN share_token SET NOT NULL;

ALTER TABLE public.expenses
    DROP CONSTRAINT IF EXISTS expenses_share_token_unique;

ALTER TABLE public.expenses
    ADD CONSTRAINT expenses_share_token_unique UNIQUE (share_token);

CREATE OR REPLACE FUNCTION public.default_expense_share_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.share_token IS NULL THEN
        NEW.share_token := public.generate_invite_token();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_default_expense_share_token ON public.expenses;
CREATE TRIGGER trg_default_expense_share_token
    BEFORE INSERT ON public.expenses
    FOR EACH ROW
    EXECUTE FUNCTION public.default_expense_share_token();

CREATE OR REPLACE FUNCTION public.get_public_expense_share_page(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row RECORD;
BEGIN
    PERFORM public.enforce_invite_preview_rate_limit();

    IF p_token IS NULL OR length(btrim(p_token)) < 12 THEN
        RETURN json_build_object('ok', FALSE);
    END IF;

    SELECT
        e.description,
        e.amount,
        e.currency,
        e.expense_date,
        g.name AS group_name,
        p.name AS payer_name
    INTO v_row
    FROM public.expenses AS e
    JOIN public.groups AS g ON g.id = e.group_id
    JOIN public.profiles AS p ON p.id = e.paid_by
    WHERE e.share_token = btrim(p_token)
      AND e.is_deleted = FALSE
      AND g.is_active = TRUE
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN json_build_object('ok', FALSE);
    END IF;

    RETURN json_build_object(
        'ok', TRUE,
        'description', v_row.description,
        'amount', v_row.amount,
        'currency', v_row.currency,
        'expense_date', v_row.expense_date,
        'group_name', v_row.group_name,
        'payer_name', COALESCE(NULLIF(btrim(v_row.payer_name), ''), 'Someone')
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_expense_share_page(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_expense_share_page(TEXT) TO anon, authenticated;
