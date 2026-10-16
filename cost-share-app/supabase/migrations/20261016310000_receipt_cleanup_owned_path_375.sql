-- #375 — Only enqueue expense-receipts cleanup for paths under the purged user's prefix.

CREATE OR REPLACE FUNCTION public.expense_receipt_object_path_for_user(
    p_user_id UUID,
    p_receipt_url TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    v_raw    TEXT;
    v_path   TEXT;
    v_prefix TEXT;
BEGIN
    IF p_user_id IS NULL OR p_receipt_url IS NULL THEN
        RETURN NULL;
    END IF;

    v_raw := btrim(p_receipt_url);
    IF v_raw = '' THEN
        RETURN NULL;
    END IF;

    IF v_raw ~* '^https?://' THEN
        v_path := regexp_replace(
            v_raw,
            '^.*(/storage/v1/object/(?:public|sign)/expense-receipts/)(.+)$',
            '\2',
            'i'
        );
        IF v_path = v_raw THEN
            RETURN NULL;
        END IF;
        v_path := split_part(v_path, '?', 1);
        v_path := split_part(v_path, '#', 1);
    ELSE
        v_path := split_part(v_raw, '?', 1);
    END IF;

    v_path := trim(both '/' FROM v_path);
    IF v_path = '' OR position('/' IN v_path) = 0 THEN
        RETURN NULL;
    END IF;

    v_prefix := p_user_id::text || '/';
    IF left(v_path, length(v_prefix)) <> v_prefix THEN
        RETURN NULL;
    END IF;

    IF v_path ~ '\.\.' THEN
        RETURN NULL;
    END IF;

    RETURN v_path;
END;
$$;

REVOKE ALL ON FUNCTION public.expense_receipt_object_path_for_user(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expense_receipt_object_path_for_user(UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.hard_purge_expired_deleted_accounts(p_limit INT DEFAULT 200)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_grace   INTERVAL := public.account_deletion_grace_interval();
    v_purged  INT := 0;
    r         RECORD;
BEGIN
    FOR r IN
        SELECT p.id AS user_id, a.id AS audit_id
        FROM profiles p
        JOIN LATERAL (
            SELECT id, deleted_at, hard_purged_at, restored_at
            FROM account_deletions_audit
            WHERE user_id = p.id
            ORDER BY deleted_at DESC
            LIMIT 1
        ) a ON TRUE
        WHERE p.is_active = FALSE
          AND p.deleted_at IS NOT NULL
          AND p.deleted_at + v_grace <= NOW()
          AND a.restored_at IS NULL
          AND a.hard_purged_at IS NULL
        LIMIT GREATEST(p_limit, 1)
    LOOP
        INSERT INTO public.storage_cleanup_queue (bucket, object_path)
        SELECT 'expense-receipts', v.path
        FROM public.expenses e
        CROSS JOIN LATERAL (
            SELECT public.expense_receipt_object_path_for_user(r.user_id, e.receipt_url) AS path
        ) v
        WHERE e.created_by = r.user_id
          AND e.receipt_url IS NOT NULL
          AND btrim(e.receipt_url) <> ''
          AND v.path IS NOT NULL
        ON CONFLICT (bucket, object_path) DO NOTHING;

        UPDATE public.expenses
            SET receipt_url = NULL
        WHERE created_by = r.user_id
          AND receipt_url IS NOT NULL;

        UPDATE auth.users
            SET banned_until = 'infinity'::timestamptz,
                email = r.user_id::text || '@deleted.kupapay.invalid',
                raw_user_meta_data = '{}'::jsonb,
                raw_app_meta_data = '{}'::jsonb
            WHERE id = r.user_id;

        DELETE FROM auth.refresh_tokens WHERE user_id = r.user_id::text;
        DELETE FROM auth.sessions WHERE user_id = r.user_id;

        UPDATE account_deletions_audit
            SET recovery_email = NULL,
                hard_purged_at = NOW(),
                notes = COALESCE(notes, '') || ' hard_purged'
            WHERE id = r.audit_id;

        v_purged := v_purged + 1;
    END LOOP;

    RETURN v_purged;
END;
$$;

REVOKE ALL ON FUNCTION public.hard_purge_expired_deleted_accounts(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hard_purge_expired_deleted_accounts(INT) TO service_role;
