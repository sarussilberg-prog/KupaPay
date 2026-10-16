const mockFrom = jest.fn();
let fromCallCount = 0;

jest.mock('../../lib/supabase', () => ({
    supabase: {
        from: (...args: unknown[]) => {
            fromCallCount += 1;
            return mockFrom(...args);
        },
    },
}));

import { prefetchAddExpensePrerequisitesBatched } from '../../hooks/queries/prefetchAddExpenseForAllGroups';
import { queryClient } from '../../lib/queryClient';

function tableChain(result: { data: unknown; error: null }) {
    const api = {
        select: jest.fn(),
        in: jest.fn(),
        eq: jest.fn(),
    };
    api.select.mockReturnValue(api);
    api.in.mockReturnValue(api);
    api.eq.mockResolvedValue(result);
    return api;
}

describe('prefetchAddExpensePrerequisitesBatched', () => {
    beforeEach(() => {
        fromCallCount = 0;
        mockFrom.mockReset();
        queryClient.clear();
    });

    it('uses two Supabase queries for many groups (not 2×N)', async () => {
        mockFrom.mockImplementation((table: string) => {
            if (table === 'group_members') {
                return tableChain({
                    data: [
                        { id: 'm1', group_id: 'g1', user_id: 'u1', is_active: true },
                        { id: 'm2', group_id: 'g2', user_id: 'u2', is_active: true },
                        { id: 'm3', group_id: 'g3', user_id: 'u3', is_active: true },
                    ],
                    error: null,
                });
            }
            if (table === 'profiles') {
                return tableChain({
                    data: [
                        { id: 'u1', name: 'A', default_currency: 'USD', is_active: true },
                        { id: 'u2', name: 'B', default_currency: 'USD', is_active: true },
                        { id: 'u3', name: 'C', default_currency: 'USD', is_active: true },
                    ],
                    error: null,
                });
            }
            return tableChain({ data: [], error: null });
        });

        prefetchAddExpensePrerequisitesBatched(['g1', 'g2', 'g3']);
        await new Promise<void>(resolve => {
            setTimeout(resolve, 0);
        });

        expect(fromCallCount).toBe(2);
    });
});
