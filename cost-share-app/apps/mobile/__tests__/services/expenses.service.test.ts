const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockToastShow = jest.fn();

jest.mock('../../lib/supabase', () => ({
    supabase: {
        from: (...args: unknown[]) => mockFrom(...args),
        rpc: (...args: unknown[]) => mockRpc(...args),
    },
}));

jest.mock('react-native-toast-message', () => ({
    __esModule: true,
    default: { show: (...args: unknown[]) => mockToastShow(...args) },
}));

jest.mock('../../i18n', () => ({ __esModule: true, default: { t: (k: string) => k } }));

import { updateExpense } from '../../services/expenses.service';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from '../../hooks/queries/keys';

const expenseRow = {
    id: 'e1',
    group_id: 'g1',
    description: 'Dinner',
    amount: 100,
    currency: 'USD',
    category: 'food',
    expense_date: '2026-05-01',
    receipt_url: null,
    paid_by: 'u1',
    created_by: 'u1',
    is_deleted: false,
    split_mode: 'equal',
    created_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-05-01T00:00:00.000Z',
};

function mockExpenseSelect() {
    mockFrom.mockImplementation((table: string) => {
        if (table === 'expenses') {
            return {
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            maybeSingle: jest.fn().mockResolvedValue({ data: expenseRow, error: null }),
                        }),
                    }),
                }),
            };
        }
        throw new Error(`Unexpected table ${table}`);
    });
}

describe('updateExpense', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockExpenseSelect();
        mockRpc.mockResolvedValue({ data: { ok: true, expense: expenseRow }, error: null });
    });

    it('calls update_expense_with_splits RPC with resolved equal splits', async () => {
        queryClient.setQueryData(queryKeys.groupExpenses('g1'), []);

        const result = await updateExpense('e1', {
            splits: [{ userId: 'u1' }, { userId: 'u2' }],
        });

        expect(result).not.toBeNull();
        expect(mockRpc).toHaveBeenCalledWith('update_expense_with_splits', {
            p_expense_id: 'e1',
            p_expense_patch: null,
            p_splits: [
                { user_id: 'u1', amount: 50 },
                { user_id: 'u2', amount: 50 },
            ],
        });
        expect(mockToastShow).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'success' }),
        );
    });

    it('rejects unequal split inputs that do not sum to the total', async () => {
        const result = await updateExpense('e1', {
            splits: [
                { userId: 'u1', amount: 30 },
                { userId: 'u2', amount: 30 },
            ],
        });

        expect(result).toBeNull();
        expect(mockRpc).not.toHaveBeenCalled();
        expect(mockToastShow).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'error',
                text2: 'expenses.splitMismatch',
            }),
        );
    });
});
