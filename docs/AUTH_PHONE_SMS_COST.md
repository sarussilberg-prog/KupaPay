# Phone / SMS auth cost research (Supabase)

**Status:** Research only — phone OTP is **not** enabled in the app without explicit product approval.

## Supabase platform (MFA / phone messaging)

Phone login and phone MFA share the same SMS provider configuration. Enabling **Advanced MFA Phone** bills **per hour** the feature is enabled (not covered by Spend Cap):

| Scope | Approx. cost |
|-------|----------------|
| First project | ~$75/month (~$0.1027/hour) |
| Additional projects | ~$10/month each |

Per [Manage Advanced MFA Phone usage](https://supabase.com/docs/guides/platform/manage-your-usage/advanced-mfa-phone), **each SMS or WhatsApp** is billed separately through your configured provider (Twilio, MessageBird, etc.).

## SMS provider (Twilio reference)

For US outbound SMS, Twilio list pricing is commonly cited around **$0.0075 per message** (varies by country, carrier, and volume). Budget **platform hourly add-on + per-message provider fees** for every OTP send and resend.

## Product implications

- **Email OTP** ships behind `EXPO_PUBLIC_ENABLE_EMAIL_AUTH=true` with no per-login SMS cost (Supabase email limits apply on Free/Pro). See [AUTH_EMAIL_OTP.md](./AUTH_EMAIL_OTP.md).
- **Phone OTP login** should not be toggled on until messaging provider + Supabase phone add-on costs are accepted and abuse/rate limits are defined.

## Related

- Login UI stub: `cost-share-app/apps/mobile/screens/auth/LoginScreen.tsx` (email magic link, flag-gated)
- Feature flag: `EXPO_PUBLIC_ENABLE_EMAIL_AUTH` in `apps/mobile/.env.example`
