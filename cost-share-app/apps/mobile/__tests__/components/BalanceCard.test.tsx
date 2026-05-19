import React from 'react';
import { render } from '@testing-library/react-native';
import { BalanceCard } from '../../components/BalanceCard';

describe('BalanceCard', () => {
    it('renders the user name', () => {
        const { getByText } = render(
            <BalanceCard userName="Bob" balance={20} currency="USD" />
        );
        expect(getByText('Bob')).toBeTruthy();
    });

    it('shows positive balance with getsBack status', () => {
        const { getByText } = render(
            <BalanceCard userName="Bob" balance={20} currency="USD" />
        );
        expect(getByText('balances.getsBack')).toBeTruthy();
        expect(getByText(/\+USD 20\.00/)).toBeTruthy();
    });

    it('shows negative balance with owes status', () => {
        const { getByText } = render(
            <BalanceCard userName="Bob" balance={-15} currency="USD" />
        );
        expect(getByText('balances.owes')).toBeTruthy();
        expect(getByText(/-USD 15\.00/)).toBeTruthy();
    });

    it('shows settled status for zero balance', () => {
        const { getByText, getByTestId } = render(
            <BalanceCard userName="Bob" balance={0} currency="USD" />
        );
        expect(getByText('balances.settledUp')).toBeTruthy();
        expect(getByTestId('balance-settled-icon')).toBeTruthy();
    });
});
