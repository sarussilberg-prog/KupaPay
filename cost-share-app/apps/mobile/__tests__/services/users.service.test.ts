const mockMaybeSingle = jest.fn();
const mockRpc = jest.fn();
const mockClearLocalAuthSession = jest.fn().mockResolvedValue(undefined);
const mockSetCurrentUser = jest.fn();

jest.mock('../../lib/supabase', () => ({
    supabase: {
        from: jest.fn((table: string) => {
            if (table === 'profiles') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: mockMaybeSingle,
                    update: mockUpdate,
                };
            }
            return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: mockMaybeSingle,
            };
        }),
        rpc: (...a: any[]) => mockRpc(...a),
    },
}));

beforeAll(() => {
    mockUpdateSelect.mockReturnValue({ maybeSingle: mockUpdateMaybeSingle });
    mockUpdateEq.mockReturnValue({ select: mockUpdateSelect });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq });
});

jest.mock('../../services/auth.service', () => ({
    clearLocalAuthSession: (...args: unknown[]) => mockClearLocalAuthSession(...args),
}));

const mockCurrentUser = { id: 'u1', isAdmin: true } as any;

jest.mock('../../store', () => ({
    useAppStore: {
        getState: () => ({
            setCurrentUser: mockSetCurrentUser,
            currentUser: mockCurrentUser,
        }),
    },
}));

jest.mock('../../lib/queryClient', () => ({
    queryClient: { clear: jest.fn(), invalidateQueries: jest.fn() },
}));

jest.mock('../../hooks/queries/keys', () => ({
    queryKeys: {},
}));

jest.mock('../../lib/auth', () => ({
    getCurrentUserId: jest.fn(),
}));

import {
    hydrateCurrentUserProfile,
    refreshCurrentUserAdminFlag,
    updateUser,
} from '../../services/users.service';

const mockUpdateMaybeSingle = jest.fn();
const mockUpdate = jest.fn();
const mockUpdateEq = jest.fn();
const mockUpdateSelect = jest.fn();

describe('hydrateCurrentUserProfile', () => {
    beforeEach(() => {
        mockMaybeSingle.mockReset();
        mockRpc.mockReset();
        mockRpc.mockImplementation((fn: string) => {
            if (fn === 'get_my_invite_token') {
                return Promise.resolve({ data: 'invite123456', error: null });
            }
            return Promise.resolve({ data: false, error: null }); // is_app_admin
        });
        mockClearLocalAuthSession.mockClear();
        mockSetCurrentUser.mockClear();
    });

    it("returns 'active' and populates the store when profile is_active=true", async () => {
        mockMaybeSingle.mockResolvedValue({
            data: { id: 'u1', is_active: true, display_name: 'Alice', email: 'a@example.com' },
            error: null,
        });

        const result = await hydrateCurrentUserProfile('u1');

        expect(result).toBe('active');
        expect(mockSetCurrentUser).toHaveBeenCalledTimes(1);
        expect(mockClearLocalAuthSession).not.toHaveBeenCalled();
    });

    it("returns 'deactivated' and clears the local session when profile is_active=false", async () => {
        mockMaybeSingle.mockResolvedValue({
            data: { id: 'u1', is_active: false, display_name: 'Alice', email: 'a@example.com' },
            error: null,
        });

        const result = await hydrateCurrentUserProfile('u1');

        expect(result).toBe('deactivated');
        expect(mockClearLocalAuthSession).toHaveBeenCalledTimes(1);
        expect(mockSetCurrentUser).not.toHaveBeenCalled();
    });

    it("returns 'unknown' on fetch error (e.g. offline) without clearing the session", async () => {
        mockMaybeSingle.mockResolvedValue({ data: null, error: new Error('Network request failed') });

        const result = await hydrateCurrentUserProfile('u1');

        expect(result).toBe('unknown');
        expect(mockClearLocalAuthSession).not.toHaveBeenCalled();
        expect(mockSetCurrentUser).not.toHaveBeenCalled();
    });

    it("returns 'unknown' when the profile row is not yet present (race with profile-creation trigger)", async () => {
        mockMaybeSingle.mockResolvedValue({ data: null, error: null });

        const result = await hydrateCurrentUserProfile('u1');

        expect(result).toBe('unknown');
        expect(mockClearLocalAuthSession).not.toHaveBeenCalled();
        expect(mockSetCurrentUser).not.toHaveBeenCalled();
    });

    it('updateUser preserves isAdmin from is_app_admin RPC (profiles row has no admin column)', async () => {
        mockRpc.mockImplementation((fn: string) => {
            if (fn === 'is_app_admin') {
                return Promise.resolve({ data: true, error: null });
            }
            return Promise.resolve({ data: null, error: null });
        });
        const updatedRow = {
            data: {
                id: 'u1',
                is_active: true,
                display_name: 'Alice',
                email: 'a@example.com',
                default_currency: 'USD',
                language: 'en',
            },
            error: null,
        };
        mockUpdateMaybeSingle.mockResolvedValue(updatedRow);

        await updateUser('u1', { name: 'Alice Updated' });

        expect(mockSetCurrentUser).toHaveBeenCalledWith(
            expect.objectContaining({ isAdmin: true }),
        );
    });

    it('refreshCurrentUserAdminFlag updates the store when RPC disagrees with cache', async () => {
        mockRpc.mockImplementation((fn: string) => {
            if (fn === 'is_app_admin') {
                return Promise.resolve({ data: true, error: null });
            }
            return Promise.resolve({ data: false, error: null });
        });
        mockCurrentUser.isAdmin = false;

        await refreshCurrentUserAdminFlag();

        expect(mockSetCurrentUser).toHaveBeenCalledWith(
            expect.objectContaining({ isAdmin: true }),
        );
    });
});
