-- Backfill orphan soft-deleted profiles produced by the v1 stub of
-- delete_my_account() (replaced in 20260617140000). The stub only flipped
-- profiles.is_active=false + deleted_at, so every account deletion left
-- the v2 side-effects undone: no audit row, no auth.users ban, no email
-- hash in the re-signup block, PII still present in profiles.
--
-- This migration finishes the job for every existing orphan so the admin
-- "Deleted users" list (which reads from account_deletions_audit) can see
-- them and the restore RPC works as expected. Idempotent — re-running is
-- a no-op once profiles are consistent.
--
-- Per-orphan work:
--   * Insert email_hash into deleted_account_emails (re-signup block)
--   * Insert account_deletions_audit row (reason = 'backfill_v1_orphan')
--   * Set auth.users.banned_until = 'infinity'
--   * Scrub PII from profiles (name/email/avatar_url/phone -> NULL)
--
-- We hash from auth.users.email (not profiles.email) because v3-fixes
-- already scrubbed some profiles' PII to NULL.

WITH orphans AS (
    SELECT
        p.id          AS user_id,
        p.deleted_at  AS deleted_at,
        encode(extensions.digest(lower(trim(u.email)), 'sha256'), 'hex') AS email_hash
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.is_active = FALSE
      AND u.email IS NOT NULL
      AND NOT EXISTS (
          SELECT 1
          FROM public.account_deletions_audit a
          WHERE a.user_id = p.id
            AND a.restored_at IS NULL
      )
),
ins_block AS (
    INSERT INTO public.deleted_account_emails (email_hash)
    SELECT email_hash FROM orphans
    ON CONFLICT (email_hash) DO NOTHING
    RETURNING 1
),
ins_audit AS (
    INSERT INTO public.account_deletions_audit
        (user_id, email_hash, reason, open_balance_snapshot, deleted_at)
    SELECT
        user_id,
        email_hash,
        'backfill_v1_orphan',
        '{}'::jsonb,
        COALESCE(deleted_at, NOW())
    FROM orphans
    RETURNING 1
),
ban_users AS (
    UPDATE auth.users u
       SET banned_until = 'infinity'::timestamptz
      FROM orphans o
     WHERE u.id = o.user_id
       AND (u.banned_until IS NULL OR u.banned_until < NOW())
    RETURNING 1
)
UPDATE public.profiles p
   SET name = NULL,
       email = NULL,
       avatar_url = NULL,
       phone = NULL,
       updated_at = NOW()
  FROM orphans o
 WHERE p.id = o.user_id;
