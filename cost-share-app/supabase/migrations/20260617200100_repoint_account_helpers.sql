-- =============================================================================
-- 20260617200100_repoint_account_helpers.sql
--
-- The drop migration removed get_user_balance_summary; this updates the two
-- account-deletion helpers that called it to use get_user_simplified_inputs
-- instead. delete_my_account stores the canonical inputs as its audit snapshot;
-- get_my_open_balances derives the same per-currency summary shape the
-- existing mobile consumer expects so the pre-deletion warning UX stays
-- unchanged.
-- =============================================================================

-- ---------- delete_my_account: store canonical inputs in the audit snapshot
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_email TEXT;
    v_hash TEXT;
    v_avatar TEXT;
    v_balance JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
    IF v_email IS NULL THEN
        RAISE EXCEPTION 'auth_user_missing';
    END IF;
    v_hash := encode(extensions.digest(lower(trim(v_email)), 'sha256'), 'hex');

    BEGIN
        v_balance := public.get_user_simplified_inputs(v_user_id);
    EXCEPTION WHEN OTHERS THEN
        v_balance := jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE);
    END;

    SELECT avatar_url INTO v_avatar FROM profiles WHERE id = v_user_id;

    INSERT INTO deleted_account_emails (email_hash)
        VALUES (v_hash)
        ON CONFLICT (email_hash) DO NOTHING;

    UPDATE profiles
        SET name = NULL,
            email = NULL,
            avatar_url = NULL,
            phone = NULL,
            is_active = FALSE,
            deleted_at = NOW(),
            updated_at = NOW()
        WHERE id = v_user_id
          AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'profile_already_inactive';
    END IF;

    UPDATE auth.users
        SET banned_until = 'infinity'::timestamptz
        WHERE id = v_user_id;

    INSERT INTO account_deletions_audit (user_id, email_hash, reason, open_balance_snapshot)
        VALUES (v_user_id, v_hash, 'self_service', v_balance);

    IF v_avatar IS NOT NULL THEN
        INSERT INTO storage_cleanup_queue (object_path)
            VALUES (v_avatar)
            ON CONFLICT (bucket, object_path) DO NOTHING;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- ---------- get_my_open_balances: derive {summary: [...]} from canonical
-- Per-currency net for auth.uid() summed across all groups (pair-level
-- residuals, not simplified — overstates rather than understates). That's
-- the right side to err on for a "do you really want to delete?" warning.
CREATE OR REPLACE FUNCTION public.get_my_open_balances()
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_payload JSONB;
    v_summary JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('summary', '[]'::jsonb);
    END IF;

    v_payload := public.get_user_simplified_inputs(v_user_id);

    WITH per_currency_net AS (
        SELECT
            c->>'currency' AS currency,
            ROUND(((n->>'net')::numeric), 2) AS net
        FROM jsonb_array_elements(v_payload->'groups') g,
             jsonb_array_elements(g->'currencies') c,
             jsonb_array_elements(c->'nets') n
        WHERE n->>'userId' = v_user_id::text
    ),
    rolled AS (
        SELECT
            currency,
            ROUND(SUM(CASE WHEN net > 0 THEN net ELSE 0 END)::numeric, 2) AS owed,
            ROUND(SUM(CASE WHEN net < 0 THEN -net ELSE 0 END)::numeric, 2) AS owe
        FROM per_currency_net
        GROUP BY currency
        HAVING SUM(CASE WHEN net > 0 THEN net ELSE 0 END) >= 0.01
            OR SUM(CASE WHEN net < 0 THEN -net ELSE 0 END) >= 0.01
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'currency', currency,
                'owed', owed,
                'owe', owe,
                'net', ROUND((owed - owe)::numeric, 2)
            )
            ORDER BY currency
        ),
        '[]'::jsonb
    )
    INTO v_summary
    FROM rolled;

    RETURN jsonb_build_object('summary', COALESCE(v_summary, '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_open_balances() TO authenticated;
