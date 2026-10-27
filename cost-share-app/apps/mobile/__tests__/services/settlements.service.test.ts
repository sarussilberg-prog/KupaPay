import { fetchSettlements } from '../../services/settlements.service';

jest.mock('../../lib/supabase', () => ({
    supabase: {
        from: jest.fn(),
    },
}));

jest.mock('../../lib/handleError', () => ({
    handleError: jest.fn(),
}));

import { supabase } from '../../lib/supabase';

const fromMock = supabase.from as jest.Mock;

describe('fetchSettlements', () => {
    beforeEach(() => {
        fromMock.mockReset();
    });

    it('rethrows after handleError so React Query keeps cached history', async () => {
        const err = { message: 'network' };
        fromMock.mockReturnValue({
            select: () => ({
                is: () => ({
                    order: () => ({
                        eq: () => Promise.resolve({ data: null, error: err }),
                    }),
                }),
            }),
        });

        await expect(fetchSettlements('group-1')).rejects.toEqual(err);
    });
});
