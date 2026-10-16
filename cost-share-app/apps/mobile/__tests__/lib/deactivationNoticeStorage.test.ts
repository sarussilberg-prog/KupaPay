import { Platform } from 'react-native';
import {
    clearDeactivationNoticePending,
    consumeDeactivationNoticePending,
    markDeactivationNoticePending,
} from '../../lib/deactivationNoticeStorage';

const mockStore = new Map<string, string>();
const mockSessionStore = new Map<string, string>();

jest.mock('../../lib/authStorage', () => ({
    authStorage: {
        getItem: (key: string) => Promise.resolve(mockStore.get(key) ?? null),
        setItem: (key: string, value: string) => {
            mockStore.set(key, value);
            return Promise.resolve();
        },
        removeItem: (key: string) => {
            mockStore.delete(key);
            return Promise.resolve();
        },
    },
}));

describe('deactivationNoticeStorage', () => {
    const originalOs = Platform.OS;

    beforeEach(() => {
        mockStore.clear();
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    });

    afterAll(() => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOs });
    });

    it('marks and consumes the pending notice once', async () => {
        await markDeactivationNoticePending();
        await expect(consumeDeactivationNoticePending()).resolves.toBe(true);
        await expect(consumeDeactivationNoticePending()).resolves.toBe(false);
    });

    it('clear removes a pending notice without consuming', async () => {
        await markDeactivationNoticePending();
        await clearDeactivationNoticePending();
        await expect(consumeDeactivationNoticePending()).resolves.toBe(false);
    });

    it('on web uses sessionStorage instead of authStorage', async () => {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });

        const session = {
            getItem: (key: string) => mockSessionStore.get(key) ?? null,
            setItem: (key: string, value: string) => {
                mockSessionStore.set(key, value);
            },
            removeItem: (key: string) => {
                mockSessionStore.delete(key);
            },
        };
        Object.defineProperty(globalThis, 'sessionStorage', {
            configurable: true,
            value: session,
        });

        mockSessionStore.clear();
        mockStore.clear();

        await markDeactivationNoticePending();
        expect(mockSessionStore.size).toBe(1);
        expect(mockStore.size).toBe(0);
    });
});
