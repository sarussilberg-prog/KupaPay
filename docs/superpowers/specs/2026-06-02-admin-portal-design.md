# Admin portal — design spec

**Status:** Approved, plan pending
**Date:** 2026-06-02
**Scope:** v1 — single feature (restore deleted users). Hub-shaped to absorb future admin tools without churn.

---

## Goal

Give a single designated user (`sarussilberg@gmail.com`) a Settings entry called
"פורטל מנהלים" that opens an in-app admin hub. v1 surfaces one operation:
list soft-deleted accounts and restore them.

The portal must be safe against deep-link bypass (DB-enforced authorization,
not just UI gating), and must be easy to extend with more admin tools later
without touching the auth model.

---

## Existing infrastructure (reused, not rebuilt)

Already in the schema:

- `profiles.is_active = FALSE` + `profiles.deleted_at` — soft-delete flag
- `auth.users.email` is **preserved** post-deletion (only `banned_until` is set);
  `profiles.email/name/avatar_url/phone` are scrubbed
- `account_deletions_audit (user_id, email_hash, deleted_at, reason,
  open_balance_snapshot, restored_at, notes)` — full audit row per deletion
- `restore_deleted_account(p_user_id, p_restored_name, p_notes)` — already
  reactivates the user, unbans `auth.users`, clears `deleted_account_emails`,
  stamps `restored_at`. Currently `GRANT EXECUTE … TO service_role` only.

This spec **does not modify** those primitives. It adds an admin role and two
RPC wrappers that route admin clicks through the existing primitive.

---

## Architecture

### 1. Admin role (DB)

Single boolean on `profiles`:

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = TRUE;
```

Seed (idempotent, runs in the migration):

```sql
UPDATE profiles SET is_admin = TRUE
WHERE id = (SELECT id FROM auth.users WHERE lower(email) = 'sarussilberg@gmail.com');
```

Helper that every admin RPC consults:

```sql
CREATE OR REPLACE FUNCTION public.is_app_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_admin FROM profiles WHERE id = auth.uid()), FALSE);
$$;
REVOKE EXECUTE ON FUNCTION public.is_app_admin() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;
```

**Why a column, not a separate table:** YAGNI. One admin today. If we ever need
role tiers, multiple admins, or a granted-by trail, we either add columns or
move to an `app_admins` table at that point — a small migration, not a rewrite.

**Why not hardcode the email in the function:** the email-in-SQL approach
couples DDL to a person. The column lets us promote/demote without DDL.

### 2. Admin RPCs

Both are `SECURITY DEFINER`, both gate on `is_app_admin()`, both granted only
to `authenticated`.

#### `admin_list_deleted_accounts() RETURNS TABLE(...)`

Returns one row per currently-deleted account, joining `account_deletions_audit`
with `auth.users` so the admin sees the original email (which `profiles` no
longer has). Only the **latest** audit row per `user_id` where
`restored_at IS NULL` is returned.

```
user_id              UUID
email                TEXT          -- from auth.users (intact)
deleted_at           TIMESTAMPTZ
reason               TEXT
open_balance_snapshot JSONB
notes                TEXT
```

Sort: `deleted_at DESC`. No pagination in v1 (admin volume is low).

#### `admin_restore_deleted_account(p_user_id UUID) RETURNS VOID`

Thin wrapper around `restore_deleted_account`. Appends
`restored_by_admin:<auth.uid()>` to the audit `notes` column so the
existing audit row tells us **who** restored.

```sql
PERFORM restore_deleted_account(
  p_user_id,
  NULL,                                  -- let the primitive pick name fallback
  'restored_by_admin:' || auth.uid()::text
);
```

Error mapping: the wrapper lets `auth_user_not_found` and
`profile_not_deleted` from the underlying primitive bubble up untouched.

### 3. Auth flow (client)

The mobile/web client never sees the `is_admin` column for other users.
Only the **caller's own** profile select includes `is_admin`, and that's how
the UI decides whether to render the Settings row.

**Type extension** (`packages/shared/src/types/index.ts`, `User` type):

```ts
isAdmin: boolean; // mirror of profiles.is_admin for the current user
```

**Mapper** (`packages/shared/src/mappers/index.ts`):

```ts
isAdmin: r.is_admin === true,  // defensive default: missing = false
```

**Profile selects** that load the current user's profile must include
`is_admin`. The plan will enumerate each call site (initial app load, post-login
refresh, settings refresh).

### 4. UI

```
SettingsScreen
  └─ "פורטל מנהלים" SettingsRow            ← rendered only if currentUser.isAdmin
        └─ AdminPortalScreen (hub)
              └─ SettingsRow "משתמשים שנמחקו"   ← count badge
                    └─ AdminDeletedUsersScreen
                          ├─ FlatList of rows (email · relative deleted-at · balance hint)
                          └─ ConfirmDialog → admin_restore_deleted_account → toast → refresh
```

**AdminPortalScreen** is a hub on purpose: future admin features
(legal-doc management, feature flags, content moderation) get added as
additional rows without restructuring.

**Defense in depth:** even if a non-admin reaches `AdminDeletedUsersScreen`
via a stale deep link, `admin_list_deleted_accounts()` raises
`not_authorized` and the client renders an error toast + empty state.

**i18n:** new keys under `settings.admin.*` (entry row, hub) and
`admin.deletedUsers.*` (list screen). Both `he.json` and `en.json`.
Default app locale is Hebrew (RTL).

**Files touched (mobile):**

- `services/admin.service.ts` *(new)*
- `screens/admin/AdminPortalScreen.tsx` *(new)*
- `screens/admin/AdminDeletedUsersScreen.tsx` *(new)*
- `screens/profile/SettingsScreen.tsx` *(conditional row)*
- `navigation/AppNavigator.tsx` *(2 routes)*
- `i18n/locales/he.json`, `i18n/locales/en.json`

---

## Files & migrations

```
cost-share-app/supabase/migrations/<ts>_admin_portal_v1.sql   ← migration
cost-share-app/supabase/schema.sql                             ← SSOT mirror
cost-share-app/supabase/__tests__/admin_portal.test.sql        ← DB tests
packages/shared/src/types/index.ts                             ← User.isAdmin
packages/shared/src/mappers/index.ts                           ← isAdmin mapper
cost-share-app/apps/mobile/services/admin.service.ts           ← new service
cost-share-app/apps/mobile/screens/admin/*                     ← new screens
cost-share-app/apps/mobile/screens/profile/SettingsScreen.tsx  ← conditional row
cost-share-app/apps/mobile/navigation/AppNavigator.tsx         ← routes
cost-share-app/apps/mobile/i18n/locales/{he,en}.json           ← strings
```

The migration is idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE
FUNCTION`, seed via `UPDATE`). It will be applied to dev
(`drxfbicunusmipdgbgdk`) as part of this work; prod
(`jfqxjjjbpxbwwvoygahu`) is out of scope for this spec and will be migrated
when dev → main is ready.

---

## Security model

| Layer | Enforcement |
|-------|-------------|
| UI | `currentUser.isAdmin` gates the Settings row |
| Routes | Open — no per-route guard (deep links land on screens that show empty state) |
| Service layer | `.rpc(...)` calls — no client-side admin check |
| DB | `is_app_admin()` raises `not_authorized` inside every admin RPC |
| RLS | Unchanged. Admin actions go through `SECURITY DEFINER` RPCs, not direct table mutations |

The admin flag is **never** exposed for other users. There's no
`SELECT … FROM profiles WHERE is_admin = TRUE` available to clients —
the only way to learn someone is admin is to log in as them.

---

## Audit

- `account_deletions_audit.restored_at` — set by the existing primitive
- `account_deletions_audit.notes` — gets `restored_by_admin:<uuid>` appended
- No new audit table for `is_admin` itself in v1. Admin grants happen via
  seeded migration today; if we add a UI for granting admin in the future,
  we'll add an `admin_grants_audit` table then.

---

## Tests

**DB** (`__tests__/admin_portal.test.sql`):

- `is_app_admin()` returns TRUE for the seeded admin, FALSE for everyone else
- `admin_list_deleted_accounts()` raises `not_authorized` for non-admins
- `admin_list_deleted_accounts()` returns rows only where `restored_at IS NULL`,
  most-recent audit row per user
- `admin_restore_deleted_account(uuid)` raises `not_authorized` for non-admins
- `admin_restore_deleted_account(uuid)` restores the profile, stamps
  `restored_at`, and notes contain `restored_by_admin:<admin uuid>`
- End-to-end: delete → list shows row → restore → list no longer shows row

**Mobile**:

- `admin.service.test.ts` — happy path + `not_authorized` error mapping
- `SettingsScreen` test — the admin row is hidden when `currentUser.isAdmin
  === false`, visible when true

**Manual smoke**:

- Log in as `sarussilberg@gmail.com`, confirm "פורטל מנהלים" appears
- Log in as another user, confirm it does not
- Self-delete a test account, restore from the portal, confirm the user can log
  back in and groups/expenses/friendships are intact

---

## Out of scope (v1)

- Granting/revoking admin from the UI (do it via SQL until needed)
- Role tiers (`super_admin`, `support`, etc.)
- Multi-admin audit trail (`granted_by`/`granted_at`)
- Pagination/search/filter on the deleted-users list
- Hard-delete from the admin portal
- Any admin feature beyond restore-deleted-user (legal docs, feature flags,
  user search, etc.) — the hub is built to absorb these later

---

## Open questions

None blocking. The hub structure absorbs uncertainty about future admin
features.
