import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithQuery } from '../../helpers/renderWithQuery';
import { AddExpenseScreen } from '../../../screens/expenses/AddExpenseScreen';
import { useAppStore } from '../../../store';
import type { MyProStatus } from '../../../services/proEntitlements.service';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockPlatformAlert = jest.fn();

jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useNavigation: () => ({
            navigate: mockNavigate,
            goBack: mockGoBack,
            setOptions: jest.fn(),
        }),
        useRoute: () => ({ params: { expenseId: 'e1', groupId: 'g1' } }),
        useFocusEffect: (cb: () => void) => cb(),
        useIsFocused: () => true,
    };
});

jest.mock('../../../lib/platformAlert', () => ({
    platformAlert: (...args: unknown[]) => mockPlatformAlert(...args),
}));

jest.mock('../../../lib/featureFlags', () => ({
    KUPAPAY_PRO_ENABLED: true,
    SHOW_KUPAPAY_PRO_UPSELL: false,
    isProUpsellSurfaceEnabled: () => true,
}));

const proStatusMock = {
    data: { hasPro: true, adminProViewMode: 'real' as const },
    hasPro: true,
    proPerkUnlocked: true,
    isLoading: false,
    adminProViewMode: 'real' as const,
};

jest.mock('../../../hooks/queries/useProStatusQuery', () => ({
    useProStatusQuery: () => proStatusMock,
}));

jest.mock('../../../services/expenses.service', () => ({
    createExpense: jest.fn(),
    updateExpense: jest.fn().mockResolvedValue({ id: 'e1' }),
    deleteExpense: jest.fn(),
    getExpenseWithSplits: jest.fn().mockResolvedValue({
        expense: {
            id: 'e1',
            groupId: 'g1',
            description: 'Rent',
            amount: 100,
            currency: 'USD',
            category: 'other',
            expenseDate: new Date('2026-01-01'),
            paidBy: 'u1',
            createdBy: 'u1',
            splitMode: 'equal',
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        splits: [{ id: 's1', expenseId: 'e1', userId: 'u1', amount: 100 }],
    }),
}));

jest.mock('../../../services/recurringExpenses.service', () => ({
    getRecurringSeriesForExpense: jest.fn().mockResolvedValue({
        seriesId: 'series-1',
        frequency: 'monthly',
        nextRunDate: '2026-02-01',
        endedAt: null,
        scheduledFor: '2026-01-01',
    }),
    updateRecurringExpenseSeries: jest.fn().mockResolvedValue(true),
    createRecurringExpenseSeries: jest.fn(),
    stopRecurringExpenseSeries: jest.fn(),
}));

jest.mock('../../../hooks/mutations/useAddExpenseMutation', () => ({
    useAddExpenseMutation: () => ({ mutate: jest.fn(), isPending: false }),
    cancelPendingAddExpense: jest.fn(),
    chainEditFollowUp: jest.fn(),
    getPendingExpenseFromCache: jest.fn(),
    resolvePendingEditAction: jest.fn(),
}));

jest.mock('../../../hooks/queries/useGroupMembersQuery', () => ({
    useGroupMembersQuery: () => ({
        data: [{ userId: 'u1', isActive: true }],
        isLoading: false,
    }),
}));

jest.mock('../../../hooks/queries/useGroupUsersQuery', () => ({
    useGroupUsersQuery: () => ({
        data: [{ id: 'u1', name: 'Alice', email: 'a@x.com' }],
        isLoading: false,
    }),
}));

jest.mock('../../../hooks/queries/useGroupsQuery', () => ({
    useGroupsQuery: () => ({
        data: [{ id: 'g1', name: 'G', defaultCurrency: 'USD' }],
        isLoading: false,
    }),
}));

describe('AddExpenseScreen recurring series edit', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        mockGoBack.mockClear();
        mockPlatformAlert.mockClear();
        useAppStore.setState({
            currentUser: {
                id: 'u1',
                email: 'a@x.com',
                name: 'Alice',
                inviteToken: 'alice123456',
                defaultCurrency: 'USD',
                language: 'en',
                isActive: true,
                isAdmin: false,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
    });

    it('shows scope dialog when saving an expense linked to an active series', async () => {
        const { findByTestId } = renderWithQuery(<AddExpenseScreen />);
        const descriptionInput = await findByTestId('description-input');
        fireEvent.changeText(descriptionInput, 'Rent updated');
        fireEvent.press(await findByTestId('add-expense-submit'));
        await waitFor(() => {
            expect(mockPlatformAlert).toHaveBeenCalledWith(
                'expenses.v2.recurring.editScopeTitle',
                'expenses.v2.recurring.editScopeBody',
                expect.any(Array),
                expect.objectContaining({ cancelable: true }),
            );
        });
    });
});
