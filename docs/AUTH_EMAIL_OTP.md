# Email OTP sign-in (Supabase)

Passwordless login uses Supabase **`signInWithOtp`** + **`verifyOtp`** with a **6-digit code** (not a magic link). The Expo mobile app and the exported web app share `LoginScreen` / `LoginEmailOtpAuth`.

**Feature flag:** `EXPO_PUBLIC_ENABLE_EMAIL_AUTH=true` (enabled on dev web builds via `apps/web/supabase-public.development.defaults`).

**SRS:** REQ-AUTH-01 (Google/Apple/email auth), REQ-AUTH-04 (web parity).

---

## Supabase projects

| Environment | Project ref | Dashboard |
|-------------|-------------|-----------|
| Development | `drxfbicunusmipdgbgdk` | [Auth settings](https://supabase.com/dashboard/project/drxfbicunusmipdgbgdk/auth/providers) |
| Production | `jfqxjjjbpxbwwvoygahu` | [Auth settings](https://supabase.com/dashboard/project/jfqxjjjbpxbwwvoygahu/auth/providers) |

Apply the same settings to **both** unless you are testing a change on dev first.

---

## Dashboard checklist (dev + prod)

### 1. Enable Email provider

**Authentication → Providers → Email**

- Email provider: **Enabled**
- **Confirm email:** optional for OTP (codes verify possession); keep aligned with your abuse posture.
- **Secure email change:** recommended **on** for production.

### 2. OTP length and expiry

**Authentication → Email → Email OTP**

- **OTP length:** `6`
- **OTP expiry:** `3600` seconds (1 hour) or shorter if you prefer tighter windows.

The app UI assumes **6 digits** (`verifyEmailOtp` rejects other lengths).

### 3. Email template (OTP, not magic link)

**Authentication → Email Templates → Magic Link** (Supabase uses this template for OTP sends when the body includes `{{ .Token }}`).

1. Copy HTML from [`cost-share-app/supabase/templates/email-otp.html`](../cost-share-app/supabase/templates/email-otp.html) into the dashboard template.
2. Ensure the body includes **`{{ .Token }}`** and does **not** rely on `{{ .ConfirmationURL }}` for login (magic-link clicks are not part of this flow).
3. Set subject per locale if you use Supabase localization; the committed template is English with KupaPay branding.

### 4. Identity linking (same user for Google / Apple / email)

**Authentication → Settings**

- **Enable automatic linking:** **On** — when a new identity’s verified email matches an existing user, Supabase links to the same `auth.users` row instead of creating a duplicate.
- **Enable manual linking:** optional; not required for this flow.

Apple **Hide My Email** (`@privaterelay.appleid.com`) will **not** match a Google/work email; that is expected.

Account deletion still blocks re-signup by email hash (`check_email_not_deleted` trigger) regardless of provider.

### 5. Rate limits and SMTP

Supabase’s **built-in email** is fine for development but has **low send limits**.

For production (and heavy dev testing):

1. **Authentication → SMTP Settings** — configure custom SMTP.
2. Recommended free/low-cost provider: [Resend](https://resend.com) (Supabase docs: [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)).
3. Set sender domain (e.g. `mail.kupa.pro`) and verify DNS.

When rate limited, Auth returns **429** or messages containing “rate limit” / “once every … seconds”. The app shows `auth.emailOtpRateLimited` and enforces a **60s client resend cooldown** after each successful send.

### 6. Redirect URLs (unchanged)

Email OTP does not use OAuth redirects. Keep existing **Redirect URLs** for Google/Apple as documented in `SUPABASE_ENVIRONMENTS.md`.

---

## App behavior

| Step | API | Notes |
|------|-----|--------|
| Enter email → Send code | `signInWithOtp({ email })` | Normalizes email to lower case |
| Enter 6-digit code | `verifyOtp({ email, token, type: 'email' })` | Then same deletion gate as OAuth |
| Deleted / grace restore | `resolveAccountDeletionGate` | Restore dialog + deactivated notice match Google/Apple |

Implementation:

- `apps/mobile/services/emailOtpAuth.service.ts`
- `apps/mobile/components/auth/LoginEmailOtpAuth.tsx`
- `apps/mobile/lib/authEmailOtpErrors.ts`

---

## Vercel / EAS env

| Variable | Dev preview | Production |
|----------|-------------|------------|
| `EXPO_PUBLIC_ENABLE_EMAIL_AUTH` | `true` (in `supabase-public.development.defaults`) | Set `true` in Vercel Production + EAS when ready |

No service-role key in the client.

---

## Lifecycle & digest email (#404 / #405)

Product lifecycle and weekly digest emails use the **same SMTP provider** as Auth (recommended: [Resend](https://resend.com) via **Authentication → SMTP**).

**Edge Function:** `email-lifecycle-dispatch` sends via the **Resend HTTP API** when these Supabase function secrets are set:

| Secret | Purpose |
|--------|---------|
| `RESEND_API_KEY` | Same key as custom SMTP / Resend dashboard |
| `TRANSACTIONAL_EMAIL_FROM` | Optional sender (default `KupaPay <noreply@kupa-pay.com>`) |
| `TRANSACTIONAL_EMAIL_ENABLED` | Set `false` to disable sends (cron still runs; marks skipped) |
| `EMAIL_LIFECYCLE_WEBHOOK_SECRET` | Cron `x-webhook-secret` |
| `PUBLIC_WEB_ORIGIN` | Unsubscribe links (default `https://kupa-pay.com`) |

If `RESEND_API_KEY` is unset, lifecycle email is **built but not sent** — preferences and unsubscribe still work.
