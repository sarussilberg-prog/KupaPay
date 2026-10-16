# Restore a deleted account (support runbook)

When a user deleted their account and contacts support to come back, restore the **same** `user_id` so friendships, groups, expenses, and balances stay linked.

## Self-service (mobile, within 30 days)

Users who deleted their account can **sign in again with the same provider** during the grace window. The app offers **Restore account** (`restore_my_account` RPC). That path requires a **fresh sign-in** (JWT issued within the last 15 minutes) and only reactivates `auth.uid()` — no cross-user restore.

## Support / admin restore

- Confirm the requester owns the email (they must write from the same address that was deleted).
- Admins use the in-app admin portal (`admin_restore_deleted_account`) or Supabase **SQL Editor** (`restore_deleted_account` as `service_role`).
- Recovery email is stored on `account_deletions_audit.recovery_email` until restore or hard purge (auth.users email is scrubbed on delete).

## Steps

1. **Look up the user** by email:

```sql
SELECT p.id, p.is_active, p.deleted_at, u.email, u.banned_until
FROM auth.users u
JOIN profiles p ON p.id = u.id
WHERE lower(trim(u.email)) = lower(trim('user@example.com'));
```

2. **Verify** `is_active = false` and `deleted_at IS NOT NULL`.

3. **Restore** (optional display name + audit note):

```sql
SELECT restore_deleted_account(
    'USER_UUID_HERE'::uuid,
    'Display Name',           -- optional; falls back to Google name or email local-part
    'Restored per support ticket #123'
);
```

4. **Ask the user** to sign in again with Google (same email). They should land in the app with their history intact.

## What restoration does

| Action | Why |
|--------|-----|
| `profiles.is_active = true`, PII restored from `auth.users` | User visible again with same id |
| `deleted_account_emails` row removed | Re-login / OAuth allowed |
| `auth.users.banned_until = null` | Supabase issues tokens again |
| `account_deletions_audit.restored_at` set | GDPR Art. 30 trail |

## What restoration does **not** do

- Does not recreate friendships or group memberships (they were never removed).
- Does not restore avatar (user can upload again); old avatar may have been queued for storage cleanup.
- Does not merge into a **new** account if they signed up with a different email — always restore the original `user_id`.

## Safety

- Same UUID → no broken FKs on expenses/settlements.
- Re-signup block is lifted only for that email hash.
- RPC rejects if profile is already active (`profile_not_deleted`).
