import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { authStorage } from '../../lib/authStorage';

jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
}));

const secureGet = SecureStore.getItemAsync as jest.Mock;
const secureSet = SecureStore.setItemAsync as jest.Mock;
const secureDelete = SecureStore.deleteItemAsync as jest.Mock;

describe('authStorage', () => {
    beforeEach(() => {
        globalThis.localStorage?.clear();
        void AsyncStorage.clear();
        secureGet.mockReset();
        secureSet.mockReset();
        secureDelete.mockResolvedValue(undefined);
    });

    it('persists values on native via SecureStore', async () => {
        if (Platform.OS === 'web') {
            return;
        }

        secureGet.mockImplementation(async (key: string) => {
            if (key === 'auth-token') return 'session-value';
            return null;
        });

        await authStorage.setItem('auth-token', 'session-value');
        expect(secureSet).toHaveBeenCalledWith('auth-token', 'session-value');
        await expect(authStorage.getItem('auth-token')).resolves.toBe('session-value');
        await authStorage.removeItem('auth-token');
        expect(secureDelete).toHaveBeenCalled();
    });

    it('chunks large native sessions across SecureStore keys', async () => {
        if (Platform.OS === 'web') {
            return;
        }

        const big = 'x'.repeat(2500);
        await authStorage.setItem('auth-token', big);
        expect(secureSet).toHaveBeenCalledWith('auth-token.__chunk_count__', '2');
        expect(secureSet).toHaveBeenCalledWith('auth-token.0', 'x'.repeat(1800));
    });

    it('migrates legacy AsyncStorage session to SecureStore on read', async () => {
        if (Platform.OS === 'web') {
            return;
        }

        await AsyncStorage.setItem('auth-token', 'legacy');
        secureGet.mockResolvedValue(null);

        await expect(authStorage.getItem('auth-token')).resolves.toBe('legacy');
        expect(secureSet).toHaveBeenCalledWith('auth-token', 'legacy');
        await expect(AsyncStorage.getItem('auth-token')).resolves.toBeNull();
    });

    it('persists values on web via localStorage', async () => {
        if (Platform.OS !== 'web') {
            return;
        }

        await authStorage.setItem('auth-token', 'session-value');
        expect(globalThis.localStorage?.getItem('auth-token')).toBe('session-value');
        await authStorage.removeItem('auth-token');
        expect(globalThis.localStorage?.getItem('auth-token')).toBeNull();
    });
});
