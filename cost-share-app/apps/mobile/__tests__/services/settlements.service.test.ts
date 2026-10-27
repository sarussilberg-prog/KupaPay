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

function chainMock(resolver: () => Promise<{ data: unknown; error: unknown }>) {
    const eq = jest.fn().mockImplementation(resolver);
    const order = jest.fn(() => ({ eq }));
    const is = jest.fn(() => ({ order }));
    const select = jest.fn(() => ({ is }));
    return { select, is, order, eq };
}

describe('fetchSettlements', () => {
    beforeEach(() => {
        fromMock.mockReset();
    });

    it('maps settlement rows for a group filter', async () => {
        const chain = chainMock(() =>
            Promise.resolve({
                data: [
                    {
                        id: 's1',
                        group_id: 'group-1',
                        from_user_id: 'u1',
                        to_user_id: 'u2',
                        amount: 42.5,
                        currency: 'USD',
                        settlement_date: '2026-01-15',
                        created_by: 'u1',
                        created_at: '2026-01-15T12:00:00Z',
                        updated_at: '2026-01-15T12:00:00Z',
                        deleted_at: null,
                    },
                ],
                error: null,
            }),
        );
        fromMock.mockReturnValue(chain);

        const rows = await fetchSettlements('group-1');
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            id: 's1',
            groupId: 'group-1',
            amount: 42.5,
            currency: 'USD',
        });
        expect(chain.eq).toHaveBeenCalledWith('group_id', 'group-1');
        expect(chain.is).toHaveBeenCalledWith('deleted_at', null);
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
