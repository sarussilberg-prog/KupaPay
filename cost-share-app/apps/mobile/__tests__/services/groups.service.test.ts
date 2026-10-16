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

jest.mock('../../lib/queryClient', () => ({
    queryClient: { setQueryData: jest.fn(), getQueryData: jest.fn(() => []) },
}));

import { fetchGroups, getGroupBalancesByCurrency } from '../../services/groups.service';

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

describe('groups.service getGroupBalancesByCurrency', () => {
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
