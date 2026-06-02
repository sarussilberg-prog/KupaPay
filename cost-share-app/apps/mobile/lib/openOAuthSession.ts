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
    const { openPartialAuthSessionAsync } = require('./openPartialAuthSession.android') as typeof import('./openPartialAuthSession.android');
    return openPartialAuthSessionAsync(authUrl, redirectUri);
  }

  return WebBrowser.openAuthSessionAsync(authUrl, redirectUri, {
    preferEphemeralSession: true,
  });
}
