# iOS Native Google Sign-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On iOS, sign in with Google through the native Google account-picker sheet (`@react-native-google-signin/google-signin`) → `supabase.auth.signInWithIdToken`, instead of the Safari browser OAuth flow. Android and web are unchanged.

**Architecture:** Extend the existing Android-only native helper (`lib/googleSignInNative.ts`) to also configure and run on iOS, then add an iOS branch to `signInWithGoogle()` in `services/auth.service.ts` that mirrors the existing native Apple flow. The native `idToken`'s audience is the iOS client ID, which Supabase already accepts (Client IDs list + Skip nonce check, configured by the user).

**Tech Stack:** Expo SDK 55, React Native, TypeScript, `@react-native-google-signin/google-signin` v16.1.2, Supabase JS, Jest.

**Working directory for all commands:** `cost-share-app/apps/mobile`

**Prerequisite (already done by the user — do not skip if re-running elsewhere):** Supabase → Auth → Providers → Google has the iOS client ID `93908207560-0fel0f2qk3oi5gpbj242nhumr3j5cfqp.apps.googleusercontent.com` in **Client IDs** and **Skip nonce check** enabled.

---

## File Structure

- `cost-share-app/apps/mobile/app.json` — add `iosUrlScheme` to the google-signin plugin (modify).
- `cost-share-app/apps/mobile/.env`, `.env.example`, `.env.production.example` — add `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (modify).
- `cost-share-app/apps/mobile/lib/googleSignInNative.ts` — iOS config + typed native sign-in result (modify).
- `cost-share-app/apps/mobile/__tests__/lib/googleSignInNative.test.ts` — new unit tests (create).
- `cost-share-app/apps/mobile/services/auth.service.ts` — route iOS Google to native (modify).
- `cost-share-app/apps/mobile/__tests__/services/auth.service.test.ts` — update mock + iOS tests (modify).

---

## Task 1: Config — iOS URL scheme + env var

No automated test (build-time config). Verification = JSON validity + existing suite stays green.

**Files:**
- Modify: `cost-share-app/apps/mobile/app.json` (plugins array)
- Modify: `cost-share-app/apps/mobile/.env`
- Modify: `cost-share-app/apps/mobile/.env.example`
- Modify: `cost-share-app/apps/mobile/.env.production.example`

- [ ] **Step 1: Add `iosUrlScheme` to the google-signin plugin in `app.json`**

Find this line in the `plugins` array:

```json
      "@react-native-google-signin/google-signin",
```

Replace it with:

```json
      [
        "@react-native-google-signin/google-signin",
        {
          "iosUrlScheme": "com.googleusercontent.apps.93908207560-0fel0f2qk3oi5gpbj242nhumr3j5cfqp"
        }
      ],
```

- [ ] **Step 2: Add the iOS client ID env var to all three env files**

Append to `.env`, `.env.example`, and `.env.production.example` (each already has `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...` — add the new line directly beneath it):

```
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=93908207560-0fel0f2qk3oi5gpbj242nhumr3j5cfqp.apps.googleusercontent.com
```

- [ ] **Step 3: Verify `app.json` is still valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('app.json','utf8')); console.log('app.json OK')"`
Expected: prints `app.json OK` (no parse error).

- [ ] **Step 4: Verify the existing test suite still passes**

Run: `npm test -- __tests__/services/auth.service.test.ts`
Expected: PASS (config changes don't touch runtime yet).

- [ ] **Step 5: Commit**

```bash
git add app.json .env.example .env.production.example
git commit -m "feat(auth): add iOS Google OAuth URL scheme and client ID env"
```

Note: `.env` is git-ignored — it won't be staged, which is correct. Only `.env.example` / `.env.production.example` are committed.

---

## Task 2: Extend `lib/googleSignInNative.ts` to iOS

Add `getGoogleIosClientId()`, configure the SDK on iOS, make `isNativeGoogleSignInEnabled()` true on iOS, and return a typed discriminated result from `signInWithGoogleNative()`.

**Files:**
- Modify: `cost-share-app/apps/mobile/lib/googleSignInNative.ts`
- Create: `cost-share-app/apps/mobile/__tests__/lib/googleSignInNative.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `cost-share-app/apps/mobile/__tests__/lib/googleSignInNative.test.ts`:

```typescript
import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  configureNativeGoogleSignIn,
  isNativeGoogleSignInEnabled,
  signInWithGoogleNative,
} from '../../lib/googleSignInNative';

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
    signOut: jest.fn().mockResolvedValue(undefined),
  },
  isErrorWithCode: () => false,
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
}));

function setPlatformOs(os: 'ios' | 'android' | 'web') {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
}

describe('googleSignInNative', () => {
  const prevWeb = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const prevIos = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

  beforeAll(() => {
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client-id';
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'ios-client-id';
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = prevWeb;
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = prevIos;
  });

  describe('configureNativeGoogleSignIn', () => {
    it('configures the iOS and web client IDs on iOS', () => {
      setPlatformOs('ios');
      configureNativeGoogleSignIn();
      expect(GoogleSignin.configure).toHaveBeenCalledWith({
        iosClientId: 'ios-client-id',
        webClientId: 'web-client-id',
        offlineAccess: false,
      });
    });

    it('configures only the web client ID on Android', () => {
      setPlatformOs('android');
      configureNativeGoogleSignIn();
      expect(GoogleSignin.configure).toHaveBeenCalledWith({
        webClientId: 'web-client-id',
        offlineAccess: false,
      });
    });

    it('does not configure on iOS when the iOS client ID is missing', () => {
      setPlatformOs('ios');
      delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
      configureNativeGoogleSignIn();
      expect(GoogleSignin.configure).not.toHaveBeenCalled();
    });
  });

  describe('isNativeGoogleSignInEnabled', () => {
    it('is true on iOS when the iOS client ID is set', () => {
      setPlatformOs('ios');
      expect(isNativeGoogleSignInEnabled()).toBe(true);
    });

    it('is false on iOS without an iOS client ID', () => {
      setPlatformOs('ios');
      delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
      expect(isNativeGoogleSignInEnabled()).toBe(false);
    });

    it('is false on web', () => {
      setPlatformOs('web');
      expect(isNativeGoogleSignInEnabled()).toBe(false);
    });
  });

  describe('signInWithGoogleNative', () => {
    it('returns a success result with the id token', async () => {
      setPlatformOs('ios');
      (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
        type: 'success',
        data: { idToken: 'tok' },
      });
      const result = await signInWithGoogleNative();
      expect(result).toEqual({ type: 'success', idToken: 'tok' });
    });

    it('returns a cancelled result when the user dismisses the picker', async () => {
      setPlatformOs('ios');
      (GoogleSignin.signIn as jest.Mock).mockResolvedValue({ type: 'cancelled', data: null });
      const result = await signInWithGoogleNative();
      expect(result).toEqual({ type: 'cancelled' });
    });

    it('returns an error result when no id token is returned', async () => {
      setPlatformOs('ios');
      (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
        type: 'success',
        data: { idToken: null },
      });
      const result = await signInWithGoogleNative();
      expect(result.type).toBe('error');
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- __tests__/lib/googleSignInNative.test.ts`
Expected: FAIL — `signInWithGoogleNative` currently returns `{ idToken }` / `{ error }` (not `{ type: ... }`), and iOS config/enabled assertions fail.

- [ ] **Step 3: Rewrite `lib/googleSignInNative.ts`**

Replace the entire contents of `cost-share-app/apps/mobile/lib/googleSignInNative.ts` with:

```typescript
import { Platform } from 'react-native';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';

/** Web OAuth client ID (Google Cloud → Web application). Not Android / Installed. */
export function getGoogleWebClientId(): string | undefined {
  const id = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  return id || undefined;
}

/** iOS OAuth client ID (Google Cloud → iOS). Drives the native account picker on iOS. */
export function getGoogleIosClientId(): string | undefined {
  const id = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  return id || undefined;
}

/** Dev-only: catch swapping Android vs Web client IDs in `.env`. */
export function warnIfGoogleWebClientIdMisconfigured(): void {
  if (!__DEV__) return;

  const id = getGoogleWebClientId();
  if (!id) return;

  // Android OAuth client (package + SHA-1) — must NOT be used as webClientId.
  if (id.includes('k0qh0eapsk135jvm7omass90hluoq67e')) {
    console.error(
      '[Auth] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is set to the Android OAuth client. '
      + 'Use the Web application client (…8m4mo0bu7edbsh2l9nd6bpbkq6ai2a20…). '
      + 'The Android client is registered only in Google Cloud (package + SHA-1).',
    );
  }
}

export function isNativeGoogleSignInEnabled(): boolean {
  if (Platform.OS === 'android') return Boolean(getGoogleWebClientId());
  if (Platform.OS === 'ios') return Boolean(getGoogleIosClientId());
  return false;
}

export function configureNativeGoogleSignIn(): void {
  if (Platform.OS === 'android') {
    const webClientId = getGoogleWebClientId();
    if (!webClientId) return;
    warnIfGoogleWebClientIdMisconfigured();
    GoogleSignin.configure({ webClientId, offlineAccess: false });
    if (__DEV__) {
      console.info('[Auth] Google Sign-In configured (Android, Web client ID)');
    }
    return;
  }

  if (Platform.OS === 'ios') {
    const iosClientId = getGoogleIosClientId();
    if (!iosClientId) return;
    // webClientId is passed as the GIDConfiguration serverClientID. With it set, Supabase
    // can verify the returned idToken (its audience is the iOS client ID, which is registered
    // in the Supabase Google provider's Client IDs list).
    GoogleSignin.configure({
      iosClientId,
      webClientId: getGoogleWebClientId(),
      offlineAccess: false,
    });
    if (__DEV__) {
      console.info('[Auth] Google Sign-In configured (iOS, native account picker)');
    }
  }
}

export type NativeGoogleSignInResult =
  | { type: 'success'; idToken: string }
  | { type: 'cancelled' }
  | { type: 'error'; error: Error };

export async function signInWithGoogleNative(): Promise<NativeGoogleSignInResult> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    try {
      await GoogleSignin.signOut();
    } catch {
      // No prior session — account picker still works.
    }

    const response = await GoogleSignin.signIn();
    if (response.type === 'cancelled') {
      return { type: 'cancelled' };
    }

    const idToken = response.data?.idToken;
    if (!idToken) {
      return { type: 'error', error: new Error('Google Sign-In returned no id token') };
    }
    return { type: 'success', idToken };
  } catch (err) {
    if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
      return { type: 'cancelled' };
    }
    if (isErrorWithCode(err) && err.code === statusCodes.IN_PROGRESS) {
      return { type: 'error', error: new Error('Sign-in already in progress') };
    }
    if (isErrorWithCode(err) && err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { type: 'error', error: new Error('Google Play Services is not available on this device') };
    }
    return { type: 'error', error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function signOutNativeGoogle(): Promise<void> {
  if (!isNativeGoogleSignInEnabled()) return;
  try {
    await GoogleSignin.signOut();
  } catch {
    // Ignore — user may not have signed in with Google on this device.
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- __tests__/lib/googleSignInNative.test.ts`
Expected: PASS (all 9 tests green).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/googleSignInNative.ts __tests__/lib/googleSignInNative.test.ts
git commit -m "feat(auth): configure native Google Sign-In on iOS"
```

---

## Task 3: Route iOS Google sign-in to the native flow

Add an iOS-native branch to `signInWithGoogle()` mirroring the native Apple flow.

**Files:**
- Modify: `cost-share-app/apps/mobile/services/auth.service.ts`
- Modify: `cost-share-app/apps/mobile/__tests__/services/auth.service.test.ts`

- [ ] **Step 1: Extend the test mock and add the failing iOS-native tests**

In `__tests__/services/auth.service.test.ts`, find the mock declarations near the top:

```typescript
const mockSignOutNativeGoogle = jest.fn().mockResolvedValue(undefined);
```

Add directly beneath it:

```typescript
const mockSignInWithGoogleNative = jest.fn();
const mockIsNativeGoogleSignInEnabled = jest.fn().mockReturnValue(false);
```

Then find this mock:

```typescript
jest.mock('../../lib/googleSignInNative', () => ({
    signOutNativeGoogle: (...args: unknown[]) => mockSignOutNativeGoogle(...args),
}));
```

Replace it with:

```typescript
jest.mock('../../lib/googleSignInNative', () => ({
    signOutNativeGoogle: (...args: unknown[]) => mockSignOutNativeGoogle(...args),
    signInWithGoogleNative: (...args: unknown[]) => mockSignInWithGoogleNative(...args),
    isNativeGoogleSignInEnabled: (...args: unknown[]) => mockIsNativeGoogleSignInEnabled(...args),
}));
```

In the top-level `describe('auth.service', () => { beforeEach(... ` block, find:

```typescript
        mockIsAuthSessionAllowed.mockResolvedValue(true);
        await signOut();
```

Insert the reset just before `await signOut();` so every test starts with native disabled unless it opts in:

```typescript
        mockIsAuthSessionAllowed.mockResolvedValue(true);
        mockIsNativeGoogleSignInEnabled.mockReturnValue(false);
        await signOut();
```

Update the existing iOS browser test so its intent is explicit. Find:

```typescript
        it('uses an ephemeral browser session on iOS', async () => {
            setPlatformOs('ios');
            mockSignInWithOAuth.mockResolvedValue({
```

Replace that opening with (adds the native-disabled precondition + clearer title):

```typescript
        it('falls back to an ephemeral browser session on iOS when native is unavailable', async () => {
            setPlatformOs('ios');
            mockIsNativeGoogleSignInEnabled.mockReturnValue(false);
            mockSignInWithOAuth.mockResolvedValue({
```

Now add a new describe block immediately after the closing `});` of the `describe('signInWithGoogle', ...)` block (i.e., before `describe('signInWithApple', ...)`):

```typescript
    describe('signInWithGoogle — native iOS', () => {
        beforeEach(() => {
            setPlatformOs('ios');
            mockIsNativeGoogleSignInEnabled.mockReturnValue(true);
            mockSignInWithIdToken.mockResolvedValue({
                data: { user: { id: 'user-1' } },
                error: null,
            });
        });

        it('exchanges the native Google id token with Supabase', async () => {
            mockSignInWithGoogleNative.mockResolvedValue({ type: 'success', idToken: 'g-id-token' });

            const result = await signInWithGoogle();

            expect(mockSignInWithIdToken).toHaveBeenCalledWith({
                provider: 'google',
                token: 'g-id-token',
            });
            expect(mockOpenOAuthSession).not.toHaveBeenCalled();
            expect(result.error).toBeNull();
        });

        it('treats a native cancel as a silent no-op', async () => {
            mockSignInWithGoogleNative.mockResolvedValue({ type: 'cancelled' });

            const result = await signInWithGoogle();

            expect(mockSignInWithIdToken).not.toHaveBeenCalled();
            expect(result.error).toBeNull();
        });

        it('surfaces a native error without falling back to the browser', async () => {
            mockSignInWithGoogleNative.mockResolvedValue({
                type: 'error',
                error: new Error('Google Play Services is not available on this device'),
            });

            const result = await signInWithGoogle();

            expect(mockSignInWithIdToken).not.toHaveBeenCalled();
            expect(mockOpenOAuthSession).not.toHaveBeenCalled();
            expect(result.error?.code).toBe('generic');
        });

        it('returns account_deleted when the profile is deactivated after token exchange', async () => {
            mockSignInWithGoogleNative.mockResolvedValue({ type: 'success', idToken: 'g-id-token' });
            mockIsAuthSessionAllowed.mockResolvedValueOnce(false);

            const result = await signInWithGoogle();

            expect(result.error?.code).toBe('account_deleted');
        });
    });
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npm test -- __tests__/services/auth.service.test.ts`
Expected: FAIL — the native-iOS tests fail because `signInWithGoogle()` still always uses the browser flow (`mockSignInWithIdToken` not called with the google token).

- [ ] **Step 3: Update the import in `services/auth.service.ts`**

Find:

```typescript
import { signOutNativeGoogle } from '../lib/googleSignInNative';
```

Replace with:

```typescript
import {
  signOutNativeGoogle,
  signInWithGoogleNative,
  isNativeGoogleSignInEnabled,
} from '../lib/googleSignInNative';
```

- [ ] **Step 4: Add the native iOS branch in `services/auth.service.ts`**

Find the current `signInWithGoogle`:

```typescript
export async function signInWithGoogle(): Promise<{ error: AuthError | null }> {
  if (Platform.OS === 'android' && __DEV__) {
    console.info('[Auth] Google OAuth in partial Chrome bottom sheet (~80%)');
  }

  return signInWithProviderBrowser('google');
}
```

Replace it with (adds a private helper above and the iOS guard inside):

```typescript
async function signInWithGoogleNativeIos(): Promise<{ error: AuthError | null }> {
  const result = await signInWithGoogleNative();

  // User dismissed the account picker — silent no-op, matching Apple cancel handling.
  if (result.type === 'cancelled') return { error: null };
  if (result.type === 'error') return { error: toAuthError(result.error) };

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: result.idToken,
  });
  if (error) return { error: toAuthError(error) };

  const allowed = await isAuthSessionAllowed();
  if (!allowed) {
    return { error: { code: 'account_deleted', message: 'account deleted' } satisfies AuthError };
  }

  return { error: null };
}

export async function signInWithGoogle(): Promise<{ error: AuthError | null }> {
  // iOS uses the native Google account-picker sheet (no browser). Android keeps the partial
  // Chrome Custom Tab; web uses the standard browser OAuth redirect.
  if (Platform.OS === 'ios' && isNativeGoogleSignInEnabled()) {
    return signInWithGoogleNativeIos();
  }

  if (Platform.OS === 'android' && __DEV__) {
    console.info('[Auth] Google OAuth in partial Chrome bottom sheet (~80%)');
  }

  return signInWithProviderBrowser('google');
}
```

- [ ] **Step 5: Run the full auth test file to verify it passes**

Run: `npm test -- __tests__/services/auth.service.test.ts`
Expected: PASS (existing browser/Apple tests + the 4 new native-iOS tests all green).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add services/auth.service.ts __tests__/services/auth.service.test.ts
git commit -m "feat(auth): use native Google Sign-In sheet on iOS"
```

---

## Task 4: Full verification

- [ ] **Step 1: Run the whole mobile test suite**

Run: `npm test`
Expected: PASS (no regressions across the app).

- [ ] **Step 2: Typecheck the whole app**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual device test (REQUIRED — native module, cannot run in Expo Go or Jest)**

Build a dev client or TestFlight build for iOS (`eas build --profile development --platform ios` or `--profile preview`), install on a real device, then:
1. Open the app at the login screen, tap **Continue with Google**.
2. Confirm the **native Google account sheet** appears in-app — **no Safari window opens**.
3. Pick an account → confirm the app lands in the authenticated state (dashboard).
4. Sign out, repeat with a device that has **no** Google account configured (add-account flow should appear).
5. Tap Google then **cancel** the sheet → app stays on login, **no error toast**.
6. Regression: on an **Android** build, confirm Google still opens the **partial Chrome bottom sheet** (unchanged).

If sign-in fails with an audience/`bad_id_token` error, re-confirm the iOS client ID is in the Supabase Google provider **Client IDs** list and **Skip nonce check** is on (Task prerequisite).

---

## Notes

- `.env` is git-ignored; the real iOS client ID lives there locally and in EAS env. Only the `.example` files are committed.
- `App.tsx` already calls `configureNativeGoogleSignIn()` on startup — no change needed; it now also configures iOS.
- Rollback: revert the `signInWithGoogle()` iOS branch, or unset `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (disables the native path → browser fallback). Supabase changes are additive and safe to leave.
