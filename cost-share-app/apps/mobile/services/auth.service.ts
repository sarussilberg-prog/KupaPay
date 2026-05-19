import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

/**
 * Expo Go on iOS simulator often resolves Metro as `localhost`, which points at the
 * simulator itself — not the Mac running Metro. Use the LAN host from Expo config instead.
 */
function resolveOAuthRedirectUri(): string {
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

  let uri = isExpoGo
    ? Linking.createURL('auth/callback')
    : Linking.createURL('auth/callback', { scheme: 'com.kupa.mobile' });

  const hostUri = Constants.expoConfig?.hostUri;
  if (uri.includes('localhost') && hostUri && !hostUri.includes('localhost')) {
    uri = uri.replace(/localhost(?=:\d+)?/, hostUri.split(':')[0]);
  }

  return uri;
}

const redirectTo = resolveOAuthRedirectUri();

console.log('[Auth] redirectTo =', redirectTo);

export async function handleAuthRedirectUrl(url: string): Promise<{ error: Error | null }> {
  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) {
    return { error: new Error(errorCode) };
  }

  const { code, access_token, refresh_token } = params;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return { error };
  }

  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    return { error };
  }

  return { error: new Error(`No auth params in redirect URL: ${url}`) };
}

export function getAuthRedirectUri(): string {
  return redirectTo;
}

export function isAuthCallbackUrl(url: string): boolean {
  if (!url.includes('auth/callback')) return false;
  const { params } = QueryParams.getQueryParams(url);
  return Boolean(params.code || params.access_token || params.error || params.error_description);
}

export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    return { error: error ?? new Error('No OAuth URL returned') };
  }

  console.log('[Auth] OAuth URL redirect_to =', redirectTo);

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
    preferEphemeralSession: true,
  });

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { error: new Error('Sign-in was cancelled') };
  }

  if (result.type !== 'success') {
    return { error: new Error(`Unexpected browser result: ${result.type}`) };
  }

  return handleAuthRedirectUrl(result.url);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
