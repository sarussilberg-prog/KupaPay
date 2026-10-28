const mockRpc = jest.fn();

jest.mock('../../lib/supabase', () => ({
    supabase: {
        rpc: (...args: unknown[]) => mockRpc(...args),
    },
}));

jest.mock('../../lib/captureError', () => ({
    captureError: jest.fn(),
}));

jest.mock('../../lib/handleError', () => ({
    handleError: jest.fn(),
}));

jest.mock('../../lib/queryClient', () => ({
    queryClient: { setQueryData: jest.fn(), getQueryData: jest.fn(() => []) },
}));

import { captureError } from '../../lib/captureError';
import { fetchMessages } from '../../services/messages.service';

beforeEach(() => {
    jest.clearAllMocks();
});

describe('messages.service fetchMessages', () => {
    it('returns mapped messages on success', async () => {
        mockRpc.mockResolvedValueOnce({
            data: [
                {
                    id: 'm1',
                    group_id: 'g1',
                    user_id: 'u1',
                    body: 'hello',
                    created_at: '2026-01-01T00:00:00.000Z',
                    updated_at: '2026-01-01T00:00:00.000Z',
                },
            ],
            error: null,
        });

        const messages = await fetchMessages('g1');
        expect(mockRpc).toHaveBeenCalledWith('get_group_messages', {
            p_group_id: 'g1',
            p_limit: 100,
        });
        expect(messages).toHaveLength(1);
        expect(messages[0]?.body).toBe('hello');
    });

    it('returns empty array and captures when RPC fails', async () => {
        const rpcError = { message: 'permission denied' };
        mockRpc.mockResolvedValueOnce({ data: null, error: rpcError });

        const messages = await fetchMessages('g1');
        expect(messages).toEqual([]);
        expect(captureError).toHaveBeenCalledWith(
            rpcError,
            expect.objectContaining({ tags: { service: 'messages', op: 'fetch' } }),
        );
    });
});
