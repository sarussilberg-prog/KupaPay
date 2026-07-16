import { QueryClient } from '@tanstack/react-query';
import type { ExpenseWithSplits } from '@cost-share/shared';
import {
    applyExpenseRealtimeEventSync,
    hydrateExpenseAfterRealtime,
} from '../../lib/applyExpenseRealtimeEvent';
import { queryKeys } from '../../hooks/queries/keys';

jest.mock('../../lib/invalidateBalanceCaches', () => ({
    invalidateBalanceCaches: jest.fn(),
}));

const baseRow = {
    id: 'exp-1',
    group_id: 'g1',
    paid_by: 'u1',
    created_by: 'u1',
    description: 'Lunch',
    amount: 40,
    currency: 'ILS',
    category: 'food',
    expense_date: '2026-07-01',
    created_at: '2026-07-01T10:00:00Z',
    updated_at: '2026-07-01T10:00:00Z',
    is_deleted: false,
};

function stubExpense(overrides: Partial<ExpenseWithSplits> = {}): ExpenseWithSplits {
    return {
        id: 'exp-1',
        groupId: 'g1',
        paidBy: 'u1',
        createdBy: 'u1',
        description: 'Lunch',
        amount: 40,
        currency: 'ILS',
        category: 'food',
        expenseDate: new Date('2026-07-01'),
        createdAt: new Date('2026-07-01T10:00:00Z'),
        updatedAt: new Date('2026-07-01T10:00:00Z'),
        isDeleted: false,
        splits: [],
        ...overrides,
    };
}

function clientWithExpenses(list: ExpenseWithSplits[] = []) {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(queryKeys.groupExpenses('g1'), list);
    return client;
}

describe('applyExpenseRealtimeEventSync', () => {
    it('upserts from payload without waiting for hydrate', () => {
        const client = clientWithExpenses();
        const hydrateId = applyExpenseRealtimeEventSync(client, 'g1', {
            eventType: 'INSERT',
            new: baseRow,
        });
        expect(hydrateId).toBe('exp-1');
        const cached = client.getQueryData<ExpenseWithSplits[]>(
            queryKeys.groupExpenses('g1'),
        );
        expect(cached).toHaveLength(1);
        expect(cached![0].id).toBe('exp-1');
        expect(cached![0].splits).toEqual([]);
        expect(cached![0].description).toBe('Lunch');
    });

    it('keeps previous splits on UPDATE until hydrate', () => {
        const client = clientWithExpenses([
            stubExpense({
                description: 'Old',
                amount: 10,
                splits: [
                    {
                        id: 's1',
                        expenseId: 'exp-1',
                        userId: 'u1',
                        amount: 10,
                        createdAt: new Date(),
                    },
                ],
            }),
        ]);
        applyExpenseRealtimeEventSync(client, 'g1', {
            eventType: 'UPDATE',
            new: { ...baseRow, description: 'Updated', amount: 50 },
        });
        const cached = client.getQueryData<ExpenseWithSplits[]>(
            queryKeys.groupExpenses('g1'),
        )!;
        expect(cached[0].description).toBe('Updated');
        expect(cached[0].splits).toHaveLength(1);
    });
});

describe('hydrateExpenseAfterRealtime', () => {
    it('overwrites the row with hydrated splits', async () => {
        const client = clientWithExpenses([stubExpense()]);
        await hydrateExpenseAfterRealtime(client, 'g1', 'exp-1', async () =>
            stubExpense({
                splits: [
                    {
                        id: 's1',
                        expenseId: 'exp-1',
                        userId: 'u1',
                        amount: 40,
                        createdAt: new Date(),
                    },
                ],
            }),
        );
        const cached = client.getQueryData<ExpenseWithSplits[]>(
            queryKeys.groupExpenses('g1'),
        )!;
        expect(cached[0].splits).toHaveLength(1);
    });

    it('invalidates groupExpenses when hydrate returns null', async () => {
        const client = clientWithExpenses();
        const spy = jest.spyOn(client, 'invalidateQueries');
        await hydrateExpenseAfterRealtime(client, 'g1', 'exp-1', async () => null);
        expect(spy).toHaveBeenCalledWith({
            queryKey: queryKeys.groupExpenses('g1'),
        });
    });
});
