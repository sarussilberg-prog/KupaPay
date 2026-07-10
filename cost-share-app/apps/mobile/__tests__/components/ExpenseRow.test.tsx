import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ExpenseRow } from '../../components/ExpenseRow';
import type { ExpenseWithDelta } from '@cost-share/shared';

const baseExpense: ExpenseWithDelta = {
    id: 'e1',
    groupId: 'g1',
    description: 'Coffee',
    amount: 30,
    currency: 'USD',
    category: 'food',
    expenseDate: new Date('2026-05-12'),
    paidBy: 'me',
    createdBy: 'me',
    isDeleted: false,
    createdAt: new Date('2026-05-12'),
    updatedAt: new Date('2026-05-12'),
    splits: [
        {
            id: 's1',
            expenseId: 'e1',
            userId: 'me',
            amount: 10,
            createdAt: new Date('2026-05-12'),
        },
        {
            id: 's2',
            expenseId: 'e1',
            userId: 'bob',
            amount: 20,
            createdAt: new Date('2026-05-12'),
        },
    ],
    myDelta: 20,
    myDeltaState: 'lent',
};

describe('ExpenseRow', () => {
    it('renders the description and amount', () => {
        const { getByText } = render(
            <ExpenseRow
                expense={baseExpense}
                currentUserId="me"
                payerName="Alice"
                onPress={() => {}}
            />,
        );
        expect(getByText('Coffee')).toBeTruthy();
        expect(getByText(/\b30(\.00)?\b/)).toBeTruthy();
    });

    it('shows the lent label when myDeltaState is lent', () => {
        const { getByText } = render(
            <ExpenseRow
                expense={baseExpense}
                currentUserId="me"
                payerName="Alice"
                onPress={() => {}}
            />,
        );
        expect(getByText(/groups\.expense\.youLent/)).toBeTruthy();
    });

    it('shows the borrowed label when myDeltaState is borrowed', () => {
        const { getByText } = render(
            <ExpenseRow
                expense={{ ...baseExpense, myDelta: -10, myDeltaState: 'borrowed' }}
                currentUserId="me"
                payerName="Alice"
                onPress={() => {}}
            />,
        );
        expect(getByText(/groups\.expense\.youBorrowed/)).toBeTruthy();
    });

    it('omits the involvement sub-line when myDelta is zero', () => {
        const { queryByText } = render(
            <ExpenseRow
                expense={{ ...baseExpense, myDelta: 0, myDeltaState: 'lent' }}
                currentUserId="me"
                payerName="Alice"
                onPress={() => {}}
            />,
        );
        expect(queryByText(/groups\.expense\.youLent/)).toBeNull();
    });

    it('shows user-relative summary when the user paid', () => {
        const { getByText } = render(
            <ExpenseRow
                expense={baseExpense}
                currentUserId="me"
                payerName="Me"
                onPress={() => {}}
            />,
        );
        expect(getByText(/groups\.expense\.feedYouPaid/)).toBeTruthy();
    });

    it('calls onPress with the expense id', () => {
        const onPress = jest.fn();
        const { getByText } = render(
            <ExpenseRow
                expense={baseExpense}
                currentUserId="me"
                payerName="Alice"
                onPress={onPress}
            />,
        );
        fireEvent.press(getByText('Coffee'));
        expect(onPress).toHaveBeenCalledWith('e1');
    });

    // The MAIN total amount is always black — its color no longer tracks the
    // viewer's net. The green/red viewer-net tone moves to the sub-line below.
    it('keeps the main amount black when the viewer lent (is owed)', () => {
        const { getByText } = render(
            <ExpenseRow
                expense={baseExpense}
                currentUserId="me"
                payerName="Alice"
                onPress={() => {}}
            />,
        );
        const main = getByText('30');
        expect(main.props.className).toContain('text-gray-900');
        expect(main.props.className).not.toContain('text-green-600');
        expect(main.props.className).not.toContain('text-red-500');
    });

    it('keeps the main amount black when the viewer borrowed (owes)', () => {
        const { getByText } = render(
            <ExpenseRow
                expense={{ ...baseExpense, myDelta: -10, myDeltaState: 'borrowed' }}
                currentUserId="me"
                payerName="Alice"
                onPress={() => {}}
            />,
        );
        const main = getByText('30');
        expect(main.props.className).toContain('text-gray-900');
        expect(main.props.className).not.toContain('text-green-600');
        expect(main.props.className).not.toContain('text-red-500');
    });

    it('keeps the main amount black when settled / not involved', () => {
        const { getByText } = render(
            <ExpenseRow
                expense={{ ...baseExpense, myDelta: 0, myDeltaState: 'settled' }}
                currentUserId="me"
                payerName="Alice"
                onPress={() => {}}
            />,
        );
        const main = getByText('30');
        expect(main.props.className).toContain('text-gray-900');
    });

    // The involvement sub-line carries the viewer-net tone. The sub-line value
    // is Math.abs(myDelta), which differs from the main total (30), so we can
    // target it distinctly by its own numeric string.
    it('colors the involvement sub-line green when the viewer lent (is owed)', () => {
        const { getByText } = render(
            <ExpenseRow
                expense={baseExpense}
                currentUserId="me"
                payerName="Alice"
                onPress={() => {}}
            />,
        );
        const sub = getByText('20');
        expect(sub.props.className).toContain('text-green-600');
    });

    it('colors the involvement sub-line red when the viewer borrowed (owes)', () => {
        const { getByText } = render(
            <ExpenseRow
                expense={{ ...baseExpense, myDelta: -10, myDeltaState: 'borrowed' }}
                currentUserId="me"
                payerName="Alice"
                onPress={() => {}}
            />,
        );
        const sub = getByText('10');
        expect(sub.props.className).toContain('text-red-500');
    });

    it('keeps the involvement sub-line neutral gray when settled', () => {
        const { getByText } = render(
            <ExpenseRow
                expense={{ ...baseExpense, myDelta: 15, myDeltaState: 'settled' }}
                currentUserId="me"
                payerName="Alice"
                onPress={() => {}}
            />,
        );
        const sub = getByText('15');
        expect(sub.props.className).toContain('text-gray-500');
        expect(sub.props.className).not.toContain('text-green-600');
        expect(sub.props.className).not.toContain('text-red-500');
    });
});
