import {
    updateRecurringExpenseSeries,
} from '../../services/recurringExpenses.service';
import { supabase } from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({
    supabase: { rpc: jest.fn() },
}));

jest.mock('../../services/expenses.service', () => ({
    resolveSplitAmounts: (total: number, inputs: { userId: string; amount?: number }[]) =>
        inputs.map(i => ({ userId: i.userId, amount: i.amount ?? total / inputs.length })),
}));

const rpcMock = supabase.rpc as jest.Mock;

describe('updateRecurringExpenseSeries', () => {
    beforeEach(() => {
        rpcMock.mockReset();
    });

    it('calls update_recurring_expense_series RPC with split payload', async () => {
        rpcMock.mockResolvedValue({ error: null });
        const ok = await updateRecurringExpenseSeries('series-1', {
            description: 'Rent',
            amount: 100,
            currency: 'USD',
            category: 'other',
            paidBy: 'u1',
            splitMode: 'equal',
            splits: [{ userId: 'u1' }, { userId: 'u2' }],
            frequency: 'monthly',
        });
        expect(ok).toBe(true);
        expect(rpcMock).toHaveBeenCalledWith(
            'update_recurring_expense_series',
            expect.objectContaining({
                p_series_id: 'series-1',
                p_description: 'Rent',
                p_frequency: 'monthly',
                p_splits: expect.arrayContaining([
                    expect.objectContaining({ user_id: 'u1' }),
                    expect.objectContaining({ user_id: 'u2' }),
                ]),
            }),
        );
    });

    it('returns false when RPC errors', async () => {
        rpcMock.mockResolvedValue({ error: new Error('pro required') });
        const ok = await updateRecurringExpenseSeries('series-1', {
            description: 'Rent',
            amount: 100,
            currency: 'USD',
            category: null,
            paidBy: 'u1',
            splitMode: 'equal',
            splits: [{ userId: 'u1', amount: 100 }],
        });
        expect(ok).toBe(false);
    });
});
