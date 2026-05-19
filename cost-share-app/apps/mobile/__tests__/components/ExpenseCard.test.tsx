import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ExpenseCard } from '../../components/ExpenseCard';
import type { Expense } from '@cost-share/shared';

const baseExpense: Expense = {
    id: 'e1',
    groupId: 'g1',
    description: 'Dinner',
    amount: 42.5,
    currency: 'USD',
    category: 'food',
    expenseDate: new Date('2026-05-01'),
    paidBy: 'u1',
    createdBy: 'u1',
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
};

describe('ExpenseCard', () => {
    it('renders description and formatted amount', () => {
        const { getByText } = render(<ExpenseCard expense={baseExpense} />);
        expect(getByText('Dinner')).toBeTruthy();
        expect(getByText(/42\.50/)).toBeTruthy();
    });

    it('shows payer name when provided', () => {
        const { getByText } = render(
            <ExpenseCard expense={baseExpense} payerName="Alice" />
        );
        expect(getByText(/Alice/)).toBeTruthy();
    });

    it('calls onPress with the expense id', () => {
        const onPress = jest.fn();
        const { getByText } = render(
            <ExpenseCard expense={baseExpense} onPress={onPress} />
        );
        fireEvent.press(getByText('Dinner'));
        expect(onPress).toHaveBeenCalledWith('e1');
    });
});
