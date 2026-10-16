import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    secureAuthGetItem,
    secureAuthRemoveItem,
    secureAuthSetItem,
} from './secureAuthStorage';

type AuthStorage = {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
};

const webStorage: AuthStorage = {
    getItem: (key) => Promise.resolve(globalThis.localStorage?.getItem(key) ?? null),
    setItem: (key, value) => {
        globalThis.localStorage?.setItem(key, value);
        return Promise.resolve();
    },
    removeItem: (key) => {
        globalThis.localStorage?.removeItem(key);
        return Promise.resolve();
    },
};

/** One-time migration from legacy AsyncStorage session keys to SecureStore. */
async function migrateLegacyAsyncStorageSession(key: string): Promise<string | null> {
    const legacy = await AsyncStorage.getItem(key);
    if (legacy == null) return null;
    await secureAuthSetItem(key, legacy);
    await AsyncStorage.removeItem(key);
    return legacy;
}

const nativeSecureStorage: AuthStorage = {
    async getItem(key) {
        const secure = await secureAuthGetItem(key);
        if (secure != null) return secure;
        return migrateLegacyAsyncStorageSession(key);
    },
    setItem(key, value) {
        return secureAuthSetItem(key, value);
    },
    removeItem(key) {
        return secureAuthRemoveItem(key);
    },
};

/** Platform-aware storage adapter for Supabase auth session persistence. */
export const authStorage: AuthStorage =
    Platform.OS === 'web' ? webStorage : nativeSecureStorage;
