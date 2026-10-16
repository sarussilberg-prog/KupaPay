import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithQuery } from '../../helpers/renderWithQuery';
import { AddExpenseScreen } from '../../../screens/expenses/AddExpenseScreen';
import { useAppStore } from '../../../store';
import type { MyProStatus } from '../../../services/proEntitlements.service';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), setOptions: jest.fn() }),
        useRoute: () => ({ params: { groupId: 'g1' } }),
        useFocusEffect: (cb: () => void) => cb(),
        useIsFocused: () => true,
    };
});

jest.mock('../../../lib/featureFlags', () => ({
    KUPAPAY_PRO_ENABLED: true,
    SHOW_KUPAPAY_PRO_UPSELL: false,
    isProUpsellSurfaceEnabled: () => true,
}));

const proStatusMock: {
    data: Partial<MyProStatus> | undefined;
    hasPro: boolean;
    proPerkUnlocked: boolean;
    isLoading: boolean;
} = {
    data: { hasPro: false },
    hasPro: false,
    proPerkUnlocked: false,
    isLoading: false,
};

jest.mock('../../../hooks/queries/useProStatusQuery', () => ({
    useProStatusQuery: () => proStatusMock,
}));

jest.mock('../../../services/expenses.service', () => ({
    createExpense: jest.fn(),
    updateExpense: jest.fn(),
    deleteExpense: jest.fn(),
    getExpenseWithSplits: jest.fn(),
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

describe('AddExpenseScreen recurring Pro gate', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        proStatusMock.data = { hasPro: false };
        proStatusMock.hasPro = false;
        proStatusMock.proPerkUnlocked = false;
        proStatusMock.isLoading = false;
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

    it('opens paywall when recurring is tapped without Pro', () => {
        const { getByTestId } = renderWithQuery(<AddExpenseScreen />);
        fireEvent.press(getByTestId('meta-recurring'));
        expect(mockNavigate).toHaveBeenCalledWith(
            'Paywall',
            expect.objectContaining({ featureKey: 'recurring_expenses' }),
        );
    });

    it('does not open paywall when admin force_pro override is active', () => {
        proStatusMock.data = { hasPro: false, adminProViewMode: 'force_pro' };
        proStatusMock.hasPro = true;
        proStatusMock.proPerkUnlocked = true;
        const { getByTestId } = renderWithQuery(<AddExpenseScreen />);
        fireEvent.press(getByTestId('meta-recurring'));
        expect(mockNavigate).not.toHaveBeenCalledWith(
            'Paywall',
            expect.anything(),
        );
    });
});
