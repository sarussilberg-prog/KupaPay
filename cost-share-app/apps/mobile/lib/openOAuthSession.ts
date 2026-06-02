import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

export type OAuthSessionResult =
  | { type: 'success'; url: string }
  | { type: 'cancel' | 'dismiss' | 'opened' | 'locked' };

/** Opens Google OAuth — partial Chrome bottom sheet on Android, system browser session on iOS. */
export async function openOAuthSession(
  authUrl: string,
  redirectUri: string,
): Promise<OAuthSessionResult> {
  if (Platform.OS === 'android') {
    try {
      const { openPartialAuthSessionAsync } = require('./openPartialAuthSession.android') as typeof import('./openPartialAuthSession.android');
      return await openPartialAuthSessionAsync(authUrl, redirectUri);
    } catch (e) {
      console.warn('[Auth] Partial Custom Tab failed, falling back to full Custom Tab', e);
      return WebBrowser.openAuthSessionAsync(authUrl, redirectUri, {
        preferEphemeralSession: true,
      });
    }
  }

  return WebBrowser.openAuthSessionAsync(authUrl, redirectUri, {
    preferEphemeralSession: true,
  });
}
