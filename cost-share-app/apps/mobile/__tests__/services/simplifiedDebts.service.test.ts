import { supabase } from '../../lib/supabase';
import { getCurrentUserId } from '../../lib/auth';
import { fetchSimplifiedInputs } from '../../services/simplifiedDebts.service';

jest.mock('../../lib/auth', () => ({ getCurrentUserId: jest.fn() }));

const mockGetCurrentUserId = getCurrentUserId as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;

describe('fetchSimplifiedInputs', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns the RPC payload on success', async () => {
        mockGetCurrentUserId.mockResolvedValue('u1');
        mockRpc.mockResolvedValue({ data: { groups: [{ groupId: 'g1' }] }, error: null });
        await expect(fetchSimplifiedInputs()).resolves.toEqual({
            groups: [{ groupId: 'g1' }],
        });
    });

    it('throws (never fabricates "all settled") when no user can be resolved', async () => {
        // A transiently-missing user must NOT be cached as an empty payload:
        // that would mark every group "Settled". Throwing keeps React Query's
        // last-known-good balances and marks the query errored instead.
        mockGetCurrentUserId.mockResolvedValue(null);
        await expect(fetchSimplifiedInputs()).rejects.toThrow();
        expect(mockRpc).not.toHaveBeenCalled();
    });

    it('throws on RPC error so a transient failure is never cached/persisted as "all settled"', async () => {
        mockGetCurrentUserId.mockResolvedValue('u1');
        mockRpc.mockResolvedValue({ data: null, error: { message: 'network down' } });
        await expect(fetchSimplifiedInputs()).rejects.toThrow();
    });
});
