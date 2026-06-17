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
    // webClientId is passed as the GIDConfiguration serverClientID. Supabase verifies the
    // returned idToken against its Google provider Client IDs list (which includes the iOS
    // client ID) with "Skip nonce check" enabled.
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
