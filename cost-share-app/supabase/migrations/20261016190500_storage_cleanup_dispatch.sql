-- #293 — Drain storage_cleanup_queue (avatars + receipts) via edge function cron.

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
        SELECT 'expense-receipts', trim(both '/' FROM e.receipt_url)
        FROM public.expenses e
        WHERE e.created_by = r.user_id
          AND e.receipt_url IS NOT NULL
          AND btrim(e.receipt_url) <> ''
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

CREATE OR REPLACE FUNCTION app_private.invoke_storage_cleanup_dispatch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_url    TEXT;
    v_secret TEXT;
BEGIN
    SELECT decrypted_secret INTO v_url
      FROM vault.decrypted_secrets WHERE name = 'storage_cleanup_dispatch_url' LIMIT 1;
    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets WHERE name = 'send_push_secret' LIMIT 1;

    IF v_url IS NULL OR v_secret IS NULL THEN
        RAISE NOTICE 'storage_cleanup_dispatch: vault URL/secret not configured — skip';
        RETURN;
    END IF;

    PERFORM net.http_post(
        url     := v_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', v_secret
        ),
        body    := '{}'::jsonb,
        timeout_milliseconds := 120000
    );
END;
$$;

DO $cron$
DECLARE
    v_job_id BIGINT;
BEGIN
    SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'storage-cleanup-dispatch-hourly' LIMIT 1;
    IF v_job_id IS NOT NULL THEN
        PERFORM cron.unschedule(v_job_id);
    END IF;
END
$cron$;

SELECT cron.schedule(
    'storage-cleanup-dispatch-hourly',
    '30 * * * *',
    $$SELECT app_private.invoke_storage_cleanup_dispatch();$$
);
