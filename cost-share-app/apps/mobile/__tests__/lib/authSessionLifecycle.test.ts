const mockStartAutoRefresh = jest.fn();
const mockStopAutoRefresh = jest.fn();
const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockSignOut = jest.fn();

jest.mock('../../lib/supabase', () => ({
    supabase: {
        auth: {
            startAutoRefresh: (...args: unknown[]) => mockStartAutoRefresh(...args),
            stopAutoRefresh: (...args: unknown[]) => mockStopAutoRefresh(...args),
            getSession: (...args: unknown[]) => mockGetSession(...args),
            onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
            signOut: (...args: unknown[]) => mockSignOut(...args),
        },
    },
}));

import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    clearStaleAuthSession,
    hydrateAuthSession,
    isInvalidRefreshTokenError,
    setupSupabaseAuthAutoRefresh,
    teardownSupabaseAuthAutoRefresh,
} from '../../lib/authSessionLifecycle';

describe('authSessionLifecycle', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        teardownSupabaseAuthAutoRefresh();
        mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
        mockSignOut.mockResolvedValue({ error: null });
        Object.defineProperty(AppState, 'currentState', {
            configurable: true,
            value: 'active',
        });
        jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('starts auto refresh on setup', () => {
        setupSupabaseAuthAutoRefresh();
        expect(mockStartAutoRefresh).toHaveBeenCalled();
    });

    it('resolves hydrateAuthSession from INITIAL_SESSION', async () => {
        const session = { user: { id: 'user-1' } };
        const unsubscribe = jest.fn();
        mockOnAuthStateChange.mockImplementation((callback) => {
            callback('INITIAL_SESSION', session);
            return { data: { subscription: { unsubscribe } } };
        });

        await expect(hydrateAuthSession()).resolves.toBe(session);
        expect(mockGetSession).not.toHaveBeenCalled();
        expect(unsubscribe).toHaveBeenCalled();
    });

    it('falls back to getSession when INITIAL_SESSION is delayed', async () => {
        jest.useFakeTimers();
        const session = { user: { id: 'user-2' } };
        const unsubscribe = jest.fn();

        mockOnAuthStateChange.mockReturnValue({
            data: { subscription: { unsubscribe } },
        });
        mockGetSession.mockResolvedValue({ data: { session }, error: null });

        const pending = hydrateAuthSession();
        jest.advanceTimersByTime(2500);

        await expect(pending).resolves.toBe(session);
        expect(unsubscribe).toHaveBeenCalled();
        jest.useRealTimers();
    });

    it('falls back to the persisted session when getSession hangs offline', async () => {
        jest.useFakeTimers();
        const unsubscribe = jest.fn();

        // Offline cold-start with an expired access token: Supabase blocks both
        // INITIAL_SESSION and getSession() on a network token-refresh that never
        // settles (airplane mode). The boot must not hang on the splash.
        mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } });
        mockGetSession.mockReturnValue(new Promise(() => {})); // never resolves

        const persisted = {
            access_token: 'stored-access',
            refresh_token: 'stored-refresh',
            expires_at: 1700000000,
            token_type: 'bearer',
            user: { id: 'user-offline' },
        };
        process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://jfqxjjjbpxbwwvoygahu.supabase.co';
        await AsyncStorage.setItem(
            'sb-jfqxjjjbpxbwwvoygahu-auth-token',
            JSON.stringify(persisted),
        );

        const pending = hydrateAuthSession();
        await jest.advanceTimersByTimeAsync(6000);

        await expect(pending).resolves.toMatchObject({ user: { id: 'user-offline' } });
        expect(unsubscribe).toHaveBeenCalled();
        jest.useRealTimers();
    });

    it('clears stale sessions when getSession reports an invalid refresh token', async () => {
        jest.useFakeTimers();
        const unsubscribe = jest.fn();

        mockOnAuthStateChange.mockReturnValue({
            data: { subscription: { unsubscribe } },
        });
        mockGetSession.mockResolvedValue({
            data: { session: null },
            error: new Error('Invalid Refresh Token: Refresh Token Not Found'),
        });

        const pending = hydrateAuthSession();
        jest.advanceTimersByTime(2500);

        await expect(pending).resolves.toBeNull();
        expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
        expect(unsubscribe).toHaveBeenCalled();
        jest.useRealTimers();
    });

    it('detects invalid refresh token errors', () => {
        expect(isInvalidRefreshTokenError(new Error('Invalid Refresh Token: Refresh Token Not Found'))).toBe(true);
        expect(isInvalidRefreshTokenError({ message: 'refresh_token_not_found' })).toBe(true);
        expect(isInvalidRefreshTokenError(new Error('Network request failed'))).toBe(false);
    });

    it('clears stale auth session locally', async () => {
        await clearStaleAuthSession();
        expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    });
});
