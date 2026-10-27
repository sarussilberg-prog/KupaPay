const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock('../../lib/supabase', () => ({
    supabase: {
        from: (...args: unknown[]) => mockFrom(...args),
        rpc: (...args: unknown[]) => mockRpc(...args),
    },
}));

jest.mock('../../lib/auth', () => ({
    getCurrentUserId: jest.fn().mockResolvedValue('user-1'),
}));

jest.mock('../../lib/captureError', () => ({
    captureError: jest.fn(),
}));

jest.mock('../../lib/handleError', () => ({
    handleError: jest.fn(),
}));

jest.mock('../../lib/appToast', () => ({
    showAppToast: jest.fn(),
    showSuccessMessage: jest.fn(),
    showSuccessToast: jest.fn(),
}));

jest.mock('../../lib/queryClient', () => ({
    queryClient: { setQueryData: jest.fn(), getQueryData: jest.fn(() => []) },
}));

import { getCurrentUserId } from '../../lib/auth';
import {
    archiveGroup,
    fetchGroups,
    getGroupBalancesByCurrency,
    getGroupContributions,
} from '../../services/groups.service';

beforeEach(() => {
    jest.clearAllMocks();
    mockRpc.mockResolvedValue({ data: [], error: null });
});

describe('groups.service fetchGroups', () => {
    it('returns empty array when user has no active memberships', async () => {
        mockFrom.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({ data: [], error: null }),
        });

        const groups = await fetchGroups();
        expect(groups).toEqual([]);
    });
});

describe('groups.service fetchGroups errors', () => {
    it('throws when there is no authenticated user', async () => {
        (getCurrentUserId as jest.Mock).mockResolvedValueOnce(null);

        await expect(fetchGroups()).rejects.toThrow('fetchGroups: no authenticated user');
    });

    it('rethrows when membership query fails', async () => {
        let eqCalls = 0;
        mockFrom.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockImplementation(function (this: unknown) {
                eqCalls += 1;
                if (eqCalls >= 2) {
                    return Promise.resolve({ data: null, error: { message: 'db down' } });
                }
                return this;
            }),
        });

        await expect(fetchGroups()).rejects.toEqual({ message: 'db down' });
    });
});

describe('groups.service archiveGroup', () => {
    it('maps structured has_balance RPC result', async () => {
        mockRpc.mockResolvedValueOnce({
            data: { ok: false, error_code: 'has_balance' },
            error: null,
        });

        const result = await archiveGroup('g1');
        expect(result).toBe('has_balance');
    });
});

describe('groups.service getGroupBalancesByCurrency', () => {
    it('returns empty list when balance load fails', async () => {
        mockFrom.mockImplementation((table: string) => {
            if (table === 'groups') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { default_currency: 'USD' },
                        error: null,
                    }),
                };
            }
            return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
            };
        });

        const result = await getGroupBalancesByCurrency('g1');
        expect(result).toEqual([]);
    });

    it('returns null when group row is missing', async () => {
        mockFrom.mockImplementation((table: string) => {
            if (table === 'groups') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                };
            }
            return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            };
        });

        const result = await getGroupBalancesByCurrency('missing-group');
        expect(result).toEqual([]);
    });
});

describe('groups.service getGroupContributions', () => {
    it('returns empty totals when load fails', async () => {
        mockFrom.mockImplementation((table: string) => {
            if (table === 'groups') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { default_currency: 'USD' },
                        error: null,
                    }),
                };
            }
            return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
            };
        });

        const result = await getGroupContributions('g1');
        expect(result).toEqual({ totals: [], matrix: [], expenseCount: 0 });
    });
});
