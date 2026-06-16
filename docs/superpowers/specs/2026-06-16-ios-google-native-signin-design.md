# iOS: Native Google Sign-In

**Date:** 2026-06-16
**Status:** Approved design — ready for implementation plan
**Owner:** navesarussi
**App:** KupaPay (`com.kupapay.mobile`), Expo SDK 55, `cost-share-app/apps/mobile`

## Goal

On iOS, replace the Safari browser OAuth flow for Google sign-in with the **native Google
Account Picker** (the in-app Google sheet iOS users expect), so Google feels as native and
polished as the existing Sign in with Apple. Android and web are unchanged.

## Current state (verified 2026-06-16)

- `signInWithGoogle()` in `services/auth.service.ts` routes **every** platform through
  `signInWithProviderBrowser('google')` → `supabase.auth.signInWithOAuth` →
  `WebBrowser.openAuthSessionAsync` (Safari `SFSafariViewController` on iOS).
- Sign in with **Apple** already uses the native pattern:
  `AppleAuthentication.signInAsync` → `supabase.auth.signInWithIdToken({ provider, token, nonce })`.
- `@react-native-google-signin/google-signin` **v16.1.2** is installed. Its config plugin is
  in `app.json` with **no options**. `lib/googleSignInNative.ts` configures the SDK **Android-only**
  (`configureNativeGoogleSignIn` early-returns unless `Platform.OS === 'android'`) and is wired
  only for **sign-out** (`signOutNativeGoogle`); `signInWithGoogleNative` exists but is never called.
- `.env` has `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=93908207560-8m4mo0bu7edbsh2l9nd6bpbkq6ai2a20…`.
  No iOS client ID env var exists.
- A new **iOS OAuth client** was created: `93908207560-0fel0f2qk3oi5gpbj242nhumr3j5cfqp…`
  (bundle `com.kupapay.mobile`), reversed scheme
  `com.googleusercontent.apps.93908207560-0fel0f2qk3oi5gpbj242nhumr3j5cfqp`.
- **Supabase Google provider is configured (done by user, verified):** `Skip nonce checks` ON;
  `Client IDs` contains web, iOS, and Android client IDs (project `93908207560`) comma-separated.

## Verified facts that shaped the design

1. **`GoogleSignin.signIn()` (Original flow) has no `nonce` parameter** — only `loginHint`
   (confirmed in the library's `SignInParams` type). So we cannot mirror Apple's nonce flow.
2. **The native iOS `idToken`'s audience is the iOS client ID**, not the web client ID
   (the library calls `GIDConfiguration(clientID: iosClientId, serverClientID: webClientId)`).
   Therefore Supabase must list the iOS client ID and skip the nonce check — which is exactly
   Supabase's documented requirement ("add web + iOS client IDs… enable Skip nonce check").
   This is the official path, not a security workaround: the token is still Google-signed,
   audience-checked, and short-lived.

## Decisions

1. **Native Google on iOS only.** Android keeps its partial Chrome Custom Tab bottom sheet
   (Google-recommended, and the user explicitly prefers it). Web unchanged.
2. **Original flow** (`GoogleSignin.signIn()`), matching the SDK usage Android already relies on —
   not the One Tap / Credential Manager API.
3. **No nonce in code**; rely on Supabase `Skip nonce check` (already enabled). Token integrity
   comes from Google's signature + audience match against the configured iOS client ID.
4. **iOS client ID via env var**, not a `GoogleService-Info.plist`.

## Design

### A. `app.json`

Replace the bare plugin entry with options so EAS adds the reversed-client-ID URL scheme to
`Info.plist`:

```json
["@react-native-google-signin/google-signin", {
  "iosUrlScheme": "com.googleusercontent.apps.93908207560-0fel0f2qk3oi5gpbj242nhumr3j5cfqp"
}]
```

### B. Env files

Add to `.env`, `.env.example`, `.env.production.example`:

```
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=93908207560-0fel0f2qk3oi5gpbj242nhumr3j5cfqp.apps.googleusercontent.com
```

### C. `lib/googleSignInNative.ts`

- Add `getGoogleIosClientId()` reading `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
- `configureNativeGoogleSignIn()`: on **iOS**, call `GoogleSignin.configure({ iosClientId,
  webClientId, offlineAccess: false })`. `webClientId` stays (serverClientID). Android branch
  unchanged. No-op if the relevant client ID is missing.
- `isNativeGoogleSignInEnabled()`: also `true` on iOS when `iosClientId` is set.
- `signInWithGoogleNative()`: keep the existing Original-flow logic (hasPlayServices is a
  no-op/quick-return on iOS; signOut-then-signIn forces the account picker). Returns
  `{ idToken }` or `{ error }`. **No nonce.**
- `signOutNativeGoogle()`: already gated by `isNativeGoogleSignInEnabled()` — now also clears
  the native iOS session on sign-out (desired).

### D. `services/auth.service.ts`

- Add an iOS-native branch to `signInWithGoogle()` (mirroring `signInWithApple` → `signInWithAppleNative`):
  - If `Platform.OS === 'ios'` and native is enabled: call `signInWithGoogleNative()`, then
    `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })` (no nonce).
  - Reuse `toAuthError`, the `account_deleted` mapping, and the post-sign-in
    `isAuthSessionAllowed()` check.
  - Treat user-cancel as a silent no-op (no error toast), matching the Apple cancel handling.
  - On any native failure, **do not** silently fall back to the browser — surface the error so
    misconfig is visible (dev) and Sentry-tracked (prod) via the existing `LoginScreen` handler.
- Android + web: unchanged (`signInWithProviderBrowser('google')`).
- `App.tsx` already calls `configureNativeGoogleSignIn()` at startup — now effective on iOS too.

### E. Out of scope / unchanged

- `LoginScreen.tsx`, `LoginGoogleButton.tsx` — no changes (same button, same handler).
- Supabase dashboard — already configured by the user.
- Android partial Chrome Custom Tab — untouched.

## Testing

- Unit: extend `lib/googleSignInNative` + `auth.service` tests — iOS routes to native and calls
  `signInWithIdToken({ provider: 'google' })`; Android/web still hit the browser flow; cancel is
  a silent no-op. Mock `@react-native-google-signin/google-signin` (already mocked in `jest-setup.ts`).
- Manual (required, native module): real iOS build (dev client or TestFlight) — tap Google →
  native account picker appears (no Safari) → session created → app enters authed state.
  Verify on a device with multiple Google accounts and with none signed in.

## Rollback

Revert the `signInWithGoogle()` iOS branch (or unset `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, which
disables the native path) to fall back to the browser flow. Supabase config changes are additive
and safe to leave in place.
