const mockRpc = jest.fn();

jest.mock('../../lib/supabase', () => ({
    supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

jest.mock('../../lib/queryClient', () => ({
    queryClient: { setQueryData: jest.fn() },
}));

import { fetchMessages } from '../../services/messages.service';

beforeEach(() => {
    mockRpc.mockReset();
});

describe('messages.service fetchMessages', () => {
    it('calls get_group_messages with group id and limit', async () => {
        mockRpc.mockResolvedValue({
            data: [
                {
                    id: 'm1',
                    group_id: 'g1',
                    user_id: 'u1',
                    body: 'hi',
                    created_at: '2026-01-01T00:00:00Z',
                    updated_at: '2026-01-01T00:00:00Z',
                    is_deleted: false,
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
        expect(messages[0].body).toBe('hi');
    });

    it('returns empty list when RPC fails', async () => {
        mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
        const messages = await fetchMessages('g1');
        expect(messages).toEqual([]);
    });
});
