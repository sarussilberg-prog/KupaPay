/**
 * Supabase PKCE needs `crypto.getRandomValues` + `crypto.subtle.digest` (SHA-256).
 */
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

export function ensureWebCryptoPolyfill(): void {
  if (Platform.OS === 'web') return;

  const cryptoRef = globalThis.crypto ?? (globalThis.crypto = {} as Crypto);

  if (typeof cryptoRef.getRandomValues !== 'function') {
    cryptoRef.getRandomValues = Crypto.getRandomValues.bind(Crypto);
  }

  if (cryptoRef.subtle) return;

  cryptoRef.subtle = {
    async digest(algorithm: AlgorithmIdentifier, data: ArrayBuffer): Promise<ArrayBuffer> {
      const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
      if (name !== 'SHA-256') {
        throw new Error(`Unsupported algorithm: ${name}`);
      }
      return Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(data));
    },
  } as SubtleCrypto;

  if (__DEV__) {
    console.info('[Auth] WebCrypto polyfill installed (expo-crypto)');
  }
}
