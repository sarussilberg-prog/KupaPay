/**
 * Supabase PKCE needs `crypto.subtle` (SHA-256). Without this, auth warns and uses `plain`.
 */
import { Platform } from 'react-native';

export function ensureWebCryptoPolyfill(): void {
  if (Platform.OS === 'web') return;
  if (globalThis.crypto?.subtle) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react-native-get-random-values');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { install } = require('react-native-quick-crypto') as { install: () => void };
    install();
    if (__DEV__) {
      console.info('[Auth] WebCrypto polyfill installed for PKCE');
    }
  } catch (e) {
    console.warn('[Auth] WebCrypto polyfill failed — PKCE may use plain', e);
  }
}
