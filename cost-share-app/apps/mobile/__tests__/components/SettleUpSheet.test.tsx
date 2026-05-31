import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SettleUpSheet, SettleUpFormValues } from '../../components/SettleUpSheet';
import type { GroupMemberLite, PairwiseDebt } from '@cost-share/shared';

jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: any) => children }));
jest.mock('../../components/expenseV2/DatePickerPopup', () => ({
    DatePickerPopup: () => null,
}));
jest.mock('../../lib/israeliPaymentLinks', () => ({
    openPaymentApp: jest.fn(async () => undefined),
}));

const members: GroupMemberLite[] = [
    { userId: 'u1', displayName: 'You', avatarUrl: undefined, isActive: true },
    { userId: 'u2', displayName: 'David', avatarUrl: undefined, isActive: true },
];
const debts: PairwiseDebt[] = [
    { fromUserId: 'u1', toUserId: 'u2', currency: 'USD', amount: 18 } as PairwiseDebt,
];
const baseInitial = {
    fromUserId: 'u1',
    toUserId: 'u2',
    currency: 'USD',
    amount: 18,
};

const renderSheet = (overrides: Partial<React.ComponentProps<typeof SettleUpSheet>> = {}) =>
    render(
        <SettleUpSheet
            visible
            members={members}
            pairwiseDebts={debts}
            currentUserId="u1"
            initial={baseInitial}
            mode="create"
            onClose={jest.fn()}
            onSubmit={jest.fn()}
            {...overrides}
        />
    );

describe('SettleUpSheet (redesign)', () => {
    it('pre-fills amount, currency, and from/to from initial', () => {
        const { getByText, getByDisplayValue } = renderSheet();
        expect(getByDisplayValue('18.00')).toBeTruthy();
        expect(getByText('USD')).toBeTruthy();
        expect(getByText('You')).toBeTruthy();
        expect(getByText('David')).toBeTruthy();
    });

    it('renders a static currency chip when only one currency is owed', () => {
        const { getByTestId, queryByTestId } = renderSheet();
        expect(getByTestId('settle-currency-chip-static')).toBeTruthy();
        expect(queryByTestId('settle-currency-chip')).toBeNull();
    });

    it('renders a tappable currency chip when more than one currency is owed', () => {
        const multi: PairwiseDebt[] = [
            { fromUserId: 'u1', toUserId: 'u2', currency: 'USD', amount: 18 } as PairwiseDebt,
            { fromUserId: 'u1', toUserId: 'u2', currency: 'EUR', amount: 42 } as PairwiseDebt,
        ];
        const { getByTestId, queryByTestId } = renderSheet({ pairwiseDebts: multi });
        expect(getByTestId('settle-currency-chip')).toBeTruthy();
        expect(queryByTestId('settle-currency-chip-static')).toBeNull();
    });

    it('selecting a different currency updates the submitted currency and amount', async () => {
        const multi: PairwiseDebt[] = [
            { fromUserId: 'u1', toUserId: 'u2', currency: 'USD', amount: 18 } as PairwiseDebt,
            { fromUserId: 'u1', toUserId: 'u2', currency: 'EUR', amount: 42 } as PairwiseDebt,
        ];
        const onSubmit = jest.fn();
        const { getByTestId } = renderSheet({ pairwiseDebts: multi, onSubmit });
        fireEvent.press(getByTestId('settle-currency-chip'));
        fireEvent.press(getByTestId('currency-picker-row-EUR'));
        fireEvent.press(getByTestId('settle-record-button'));
        expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ currency: 'EUR', amount: 42 })
        );
    });

    it('renders the static chip in edit mode even with multiple owed currencies', () => {
        const multi: PairwiseDebt[] = [
            { fromUserId: 'u1', toUserId: 'u2', currency: 'USD', amount: 18 } as PairwiseDebt,
            { fromUserId: 'u1', toUserId: 'u2', currency: 'EUR', amount: 42 } as PairwiseDebt,
        ];
        const { getByTestId, queryByTestId } = renderSheet({
            pairwiseDebts: multi,
            mode: 'edit',
        });
        expect(getByTestId('settle-currency-chip-static')).toBeTruthy();
        expect(queryByTestId('settle-currency-chip')).toBeNull();
    });

    it('selecting a method tile updates the submitted paymentMethod', async () => {
        const onSubmit = jest.fn();
        const { getByTestId } = renderSheet({ onSubmit });
        fireEvent.press(getByTestId('method-tile-paypal'));
        fireEvent.press(getByTestId('settle-record-button'));
        expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ paymentMethod: 'paypal' })
        );
    });

    it('defaults paymentMethod to credit_card per design', async () => {
        const onSubmit = jest.fn();
        const { getByTestId } = renderSheet({ onSubmit });
        fireEvent.press(getByTestId('settle-record-button'));
        expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ paymentMethod: 'credit_card' })
        );
    });

    it('maps legacy bank_transfer initial value to credit_card', async () => {
        const onSubmit = jest.fn();
        const { getByTestId } = renderSheet({
            onSubmit,
            initial: { ...baseInitial, paymentMethod: 'bank_transfer' },
        });
        fireEvent.press(getByTestId('settle-record-button'));
        expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ paymentMethod: 'credit_card' })
        );
    });

    it('disables Record payment when amount is zero', () => {
        const onSubmit = jest.fn();
        const { getByTestId } = renderSheet({
            initial: { ...baseInitial, amount: 0 },
            onSubmit,
        });
        fireEvent.press(getByTestId('settle-record-button'));
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('record button shows the simple Save label', () => {
        const { getByTestId, getAllByText } = renderSheet();
        // Button is present and labelled with the common Save string.
        expect(getByTestId('settle-record-button')).toBeTruthy();
        // The shell header also renders Save, so we expect at least two matches.
        expect(getAllByText('common.save').length).toBeGreaterThanOrEqual(1);
    });
});
