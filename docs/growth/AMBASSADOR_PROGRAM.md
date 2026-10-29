# Ambassador program (#420)

Zero-cash program for travel creators and student group leaders: **manual approval**, complimentary **Pro** (`profiles.pro_until`), and a tracked **`?ref=AMB-…`** referral code.

## Public application (web)

- Localized pages: `https://kupa-pay.com/{locale}/ambassadors` (7 locales, RTL for `he` / `ar`).
- Applicants must **sign in** on the web app, then submit via RPC `submit_ambassador_application`.
- Pro is **never** auto-granted.

## Admin approval (development Supabase only unless explicitly approved for prod)

Use an **app admin** account (`app_admins` table).

1. List pending applications:

```sql
SELECT * FROM public.admin_list_ambassador_applications('pending');
```

Or from SQL editor as service role:

```sql
SELECT id, user_id, audience_type, primary_link, message, created_at
FROM public.ambassador_applications
WHERE status = 'pending'
ORDER BY created_at;
```

2. Approve (grants Pro + creates referral code):

```sql
SELECT public.admin_approve_ambassador_application(
  '<application_uuid>'::uuid,
  365  -- pro duration in days (30–730)
);
```

Returns `referral_code`, `pro_until`, and `user_id`. Share with the ambassador:

`https://kupa-pay.com/en?ref=<referral_code>` (any locale prefix works).

3. Reject:

```sql
SELECT public.admin_reject_ambassador_application(
  '<application_uuid>'::uuid,
  'optional reason'
);
```

### Mobile admin RPCs (same functions)

Authenticated app admins can also call `admin_list_ambassador_applications`, `admin_approve_ambassador_application`, and `admin_reject_ambassador_application` via Supabase client RPCs (no dedicated admin UI in v1).

## Referral attribution

- Marketing and invite landings store `?ref=AMB-…` in cookie `kupay_ambassador_ref` (90 days) or mobile local storage.
- After sign-in, clients call `attribute_ambassador_referral(p_code)` once per user.
- Reporting: `ambassador_referrals` table; ambassadors see counts via `get_my_ambassador_referral_stats()`.

## RevenueCat

Approval updates **`profiles.pro_until`** (same source of truth as promo codes). Optional RevenueCat promotional sync is **not** wired for ambassadors in v1 — mobile Pro still resolves from `pro_until` / store entitlements per existing app logic.
