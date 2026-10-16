# Delete account — session revocation verification

**Related:** KI-034, GitHub #112, migration `cost-share-app/supabase/migrations/20261010220000_delete_my_account_sessions.sql`.

## Expected behavior

`delete_my_account()` must:

1. Soft-delete the caller's profile (`is_active = false`).
2. Ban the auth user and scrub PII on `auth.users`.
3. Delete all rows in `auth.sessions` for the user UUID.
4. Delete all rows in `auth.refresh_tokens` where `user_id` matches the user id as **text** (`user_id::text`).

Without (3) and (4), a deleted user could refresh or reuse an existing session.

## Regression test

Run `cost-share-app/supabase/__tests__/delete_my_account.test.sql` against the **development** Supabase project (`drxfbicunusmipdgbgdk`) inside a transaction (the file ends with `ROLLBACK`).

Before merging `dev` → `main`, confirm `auth.refresh_tokens.user_id` column type on production still accepts text comparison (Supabase version drift).

## Production check (manual)

After deploy to `jfqxjjjbpxbwwvoygahu`:

```sql
SELECT data_type
FROM information_schema.columns
WHERE table_schema = 'auth'
  AND table_name = 'refresh_tokens'
  AND column_name = 'user_id';
```

Expected: `text` (or compatible). If type differs, adjust the delete predicate in a follow-up migration — do not cast blindly.
