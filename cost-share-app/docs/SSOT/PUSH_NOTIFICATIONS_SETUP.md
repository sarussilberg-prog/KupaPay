# Push Notifications — Per-Environment Setup

These steps are run **once per Supabase project** (dev `drxfbicunusmipdgbgdk`, prod
`jfqxjjjbpxbwwvoygahu`). They are intentionally NOT in migrations because they contain secrets.

## 1. Vault secrets (powers the activity_events → send-push trigger)

Generate a random shared secret and store both values in Vault:

```sql
-- Run in the target project's SQL editor. Replace <PROJECT_REF> and <RANDOM_SECRET>.
SELECT vault.create_secret(
  'https://<PROJECT_REF>.supabase.co/functions/v1/send-push', 'send_push_url',  'send-push function URL');
SELECT vault.create_secret(
  '<RANDOM_SECRET>', 'send_push_secret', 'shared secret validated by send-push');
```
Generate `<RANDOM_SECRET>` with `openssl rand -hex 32`.

## 2. Edge Function secrets

Set the same secret as a function env var so `send-push` can validate the header:

```bash
supabase secrets set PUSH_WEBHOOK_SECRET=<RANDOM_SECRET> --project-ref <PROJECT_REF>
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase.

## 3. Deploy the function

```bash
supabase functions deploy send-push --project-ref <PROJECT_REF>
```

## 4. EAS push credentials (Phase 4)

- iOS: `eas credentials` → push key (APNs) under Apple Team `HVW3H3DLRB`.
- Android: create a Firebase project for `com.kupapay.mobile`, upload the FCM v1 service account
  key to EAS (`eas credentials` → Android → FCM V1).
