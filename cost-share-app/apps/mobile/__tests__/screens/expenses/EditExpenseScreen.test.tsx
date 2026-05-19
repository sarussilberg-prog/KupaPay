import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
        useRoute: () => ({ params: { expenseId: 'e1' } }),
        useFocusEffect: (cb: () => void) => cb(),
        useIsFocused: () => true,
    };
});

jest.mock('../../../services/expenses.service', () => ({
    getExpenseById: jest.fn(),
    updateExpense: jest.fn(),
    deleteExpense: jest.fn(),
}));

import { EditExpenseScreen } from '../../../screens/expenses/EditExpenseScreen';
import {
    getExpenseById,
    updateExpense,
} from '../../../services/expenses.service';

const mockGet = getExpenseById as jest.MockedFunction<typeof getExpenseById>;
const mockUpdate = updateExpense as jest.MockedFunction<typeof updateExpense>;

const expense = {
    id: 'e1',
    groupId: 'g1',
    description: 'Coffee',
    amount: 5,
    currency: 'USD',
    category: 'food' as const,
    expenseDate: new Date('2026-05-01'),
    paidBy: 'u1',
    createdBy: 'u1',
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
};

beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockGet.mockReset();
    mockUpdate.mockReset();
});

describe('EditExpenseScreen', () => {
    it('loads existing expense data into form', async () => {
        mockGet.mockResolvedValueOnce(expense);
        const { findByDisplayValue } = render(<EditExpenseScreen />);
        expect(await findByDisplayValue('Coffee')).toBeTruthy();
        expect(await findByDisplayValue('5')).toBeTruthy();
    });

    it('calls updateExpense with new values', async () => {
        mockGet.mockResolvedValueOnce(expense);
        mockUpdate.mockResolvedValueOnce({ ...expense, description: 'Tea' });
        const { findByDisplayValue, findByText } = render(<EditExpenseScreen />);
        const descInput = await findByDisplayValue('Coffee');
        fireEvent.changeText(descInput, 'Tea');
        fireEvent.press(await findByText('common.save'));
        await waitFor(() =>
            expect(mockUpdate).toHaveBeenCalledWith(
                'e1',
                expect.objectContaining({ description: 'Tea' })
            )
        );
    });

    it('cancel button navigates back', async () => {
        mockGet.mockResolvedValueOnce(expense);
        const { findByText } = render(<EditExpenseScreen />);
        fireEvent.press(await findByText('common.cancel'));
        expect(mockGoBack).toHaveBeenCalled();
    });
});
