import { renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('../../lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

jest.mock('../../store', () => ({
    useAppStore: (selector: (s: unknown) => unknown) =>
        selector({ currentUser: { id: 'me' } }),
}));

import { useGroupUnreadCounts } from '../../hooks/queries/useGroupUnreadCounts';
import { supabase } from '../../lib/supabase';

const rpc = supabase.rpc as jest.Mock;

function wrapper({ children }: { children: React.ReactNode }) {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return React.createElement(QueryClientProvider, { client }, children);
}

describe('useGroupUnreadCounts', () => {
    beforeEach(() => rpc.mockReset());

    it('maps the RPC rows into a groupId -> unread record', async () => {
        rpc.mockResolvedValueOnce({
            data: [
                { group_id: 'g1', unread: 3 },
                { group_id: 'g2', unread: 1 },
            ],
            error: null,
        });
        const { result } = renderHook(() => useGroupUnreadCounts(), { wrapper });
        await waitFor(() => expect(result.current.data).toBeDefined());
        expect(rpc).toHaveBeenCalledWith('get_group_unread_counts');
        expect(result.current.data).toEqual({ g1: 3, g2: 1 });
    });

    it('returns an empty map when the RPC errors', async () => {
        rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
        const { result } = renderHook(() => useGroupUnreadCounts(), { wrapper });
        await waitFor(() => expect(result.current.data).toEqual({}));
    });
});
