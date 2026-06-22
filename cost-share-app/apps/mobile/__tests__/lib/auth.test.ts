import { assertProfileActiveWithTimeout, getCurrentUserId, isAuthSessionAllowed } from '../../lib/auth';

const mockMaybeSingle = jest.fn();
const mockRpc = jest.fn();
const mockGetUser = jest.fn();
const mockGetSession = jest.fn();
const mockClearStaleAuthSession = jest.fn().mockResolvedValue(undefined);
const mockSetSession = jest.fn();

jest.mock('../../lib/authSessionLifecycle', () => ({
    clearStaleAuthSession: (...args: unknown[]) => mockClearStaleAuthSession(...args),
}));

jest.mock('../../store', () => ({
    useAppStore: {
        getState: () => ({ setSession: mockSetSession }),
    },
}));

jest.mock('../../lib/supabase', () => ({
    supabase: {
        auth: {
            getUser: (...args: unknown[]) => mockGetUser(...args),
            getSession: (...args: unknown[]) => mockGetSession(...args),
        },
        rpc: (...args: unknown[]) => mockRpc(...args),
        from: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: mockMaybeSingle,
        })),
    },
}));

describe('getCurrentUserId', () => {
    beforeEach(() => {
        mockGetSession.mockReset();
        mockGetUser.mockReset();
    });

    it('returns the user id from the local session without a network getUser call', async () => {
        mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null });
        await expect(getCurrentUserId()).resolves.toBe('u1');
        expect(mockGetUser).not.toHaveBeenCalled();
    });

    it('returns the cached session id even when offline (a network getUser would resolve null)', async () => {
        // Regression: getUser() is a network round-trip that returns null in
        // airplane mode. That null made fetchSimplifiedInputs return EMPTY and
        // every group fabricate a false "Settled". The id must come from the
        // locally-stored session so it survives going offline.
        mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null });
        await expect(getCurrentUserId()).resolves.toBe('u1');
    });

    it('returns null when there is no stored session', async () => {
        mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
        await expect(getCurrentUserId()).resolves.toBeNull();
    });
});

describe('assertProfileActiveWithTimeout', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockMaybeSingle.mockReset();
        mockRpc.mockReset();
        mockGetUser.mockReset();
        mockClearStaleAuthSession.mockClear();
        mockSetSession.mockClear();
        mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
        mockRpc.mockResolvedValue({ data: true, error: null });
        mockMaybeSingle.mockResolvedValue({ data: { is_active: true }, error: null });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('returns deactivated when is_caller_active RPC is false and profile is inactive', async () => {
        mockRpc.mockResolvedValue({ data: false, error: null });
        mockMaybeSingle.mockResolvedValue({ data: { is_active: false }, error: null });
        await expect(assertProfileActiveWithTimeout(100)).resolves.toBe('deactivated');
        expect(mockClearStaleAuthSession).toHaveBeenCalled();
        expect(mockSetSession).toHaveBeenCalledWith(null);
    });

    it('returns active when is_caller_active RPC is false but profile row is active', async () => {
        mockRpc.mockResolvedValue({ data: false, error: null });
        mockMaybeSingle.mockResolvedValue({ data: { is_active: true }, error: null });
        await expect(assertProfileActiveWithTimeout(100)).resolves.toBe('active');
        expect(mockClearStaleAuthSession).not.toHaveBeenCalled();
        expect(mockSetSession).not.toHaveBeenCalled();
    });

    it('returns deactivated when profile is inactive', async () => {
        mockRpc.mockResolvedValue({ data: null, error: new Error('rpc failed') });
        mockMaybeSingle.mockResolvedValue({ data: { is_active: false }, error: null });
        await expect(assertProfileActiveWithTimeout(100)).resolves.toBe('deactivated');
        expect(mockClearStaleAuthSession).toHaveBeenCalled();
        expect(mockSetSession).toHaveBeenCalledWith(null);
    });

    it('returns unknown when both RPC and profile lookup fail (e.g. offline)', async () => {
        mockRpc.mockResolvedValue({ data: null, error: new Error('Network request failed') });
        mockMaybeSingle.mockResolvedValue({ data: null, error: new Error('Network request failed') });
        await expect(assertProfileActiveWithTimeout(100)).resolves.toBe('unknown');
        expect(mockClearStaleAuthSession).not.toHaveBeenCalled();
        expect(mockSetSession).not.toHaveBeenCalled();
    });

    it('returns unknown when supabase.auth.getUser errors', async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Network request failed') });
        await expect(assertProfileActiveWithTimeout(100)).resolves.toBe('unknown');
        expect(mockClearStaleAuthSession).not.toHaveBeenCalled();
    });

    it('returns unknown when the profile check exceeds the timeout', async () => {
        mockRpc.mockReturnValue(new Promise(() => {}));
        mockMaybeSingle.mockReturnValue(new Promise(() => {}));
        const pending = assertProfileActiveWithTimeout(50);
        jest.advanceTimersByTime(50);
        await expect(pending).resolves.toBe('unknown');
    });
});

describe('isAuthSessionAllowed', () => {
    beforeEach(() => {
        mockMaybeSingle.mockReset();
        mockRpc.mockReset();
        mockGetUser.mockReset();
        mockClearStaleAuthSession.mockClear();
        mockSetSession.mockClear();
        mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
        mockRpc.mockResolvedValue({ data: true, error: null });
        mockMaybeSingle.mockResolvedValue({ data: { is_active: true }, error: null });
    });

    it('returns true when the profile is active', async () => {
        await expect(isAuthSessionAllowed()).resolves.toBe(true);
    });

    it('returns false only when the server explicitly says the account is deactivated', async () => {
        mockRpc.mockResolvedValue({ data: false, error: null });
        mockMaybeSingle.mockResolvedValue({ data: { is_active: false }, error: null });
        await expect(isAuthSessionAllowed()).resolves.toBe(false);
    });

    it('returns true when the verification fails with a network error (does not falsely block offline users)', async () => {
        mockRpc.mockResolvedValue({ data: null, error: new Error('Network request failed') });
        mockMaybeSingle.mockResolvedValue({ data: null, error: new Error('Network request failed') });
        await expect(isAuthSessionAllowed()).resolves.toBe(true);
    });
});
