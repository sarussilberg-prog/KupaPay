import React from 'react';
import { render } from '@testing-library/react-native';
import { GroupTotalsCard } from '../../../components/balances/GroupTotalsCard';

describe('GroupTotalsCard', () => {
    it('renders all three stat labels', () => {
        const { getByText } = render(
            <GroupTotalsCard
                totalSpent={[{ currency: 'USD', amount: 100 }]}
                unsettled={[]}
                expenseCount={1}
                defaultCurrency="USD"
            />,
        );
        // Single-currency groups render the "total spent in <currency>" label.
        expect(getByText('balances.totalSpentIn')).toBeTruthy();
        expect(getByText('balances.unsettled')).toBeTruthy();
        // Pluralised — matched via regex because t() mock returns bare key.
        expect(getByText(/balances\.expenseCount/i)).toBeTruthy();
    });

    it('renders one line per currency in total spent', () => {
        const { getByText } = render(
            <GroupTotalsCard
                totalSpent={[
                    { currency: 'USD', amount: 450 },
                    { currency: 'ILS', amount: 1200 },
                ]}
                unsettled={[]}
                expenseCount={5}
                defaultCurrency="USD"
            />,
        );
        expect(getByText('USD 450.00')).toBeTruthy();
        expect(getByText('ILS 1200.00')).toBeTruthy();
    });

    it('shows the empty-state line when unsettled is empty', () => {
        const { getAllByText } = render(
            <GroupTotalsCard
                totalSpent={[{ currency: 'USD', amount: 100 }]}
                unsettled={[]}
                expenseCount={2}
                defaultCurrency="USD"
            />,
        );
        // CurrencyAmountList renders balances.noActivityInMode when amounts is empty.
        expect(getAllByText('balances.noActivityInMode').length).toBeGreaterThanOrEqual(1);
    });

    it('renders the expense-count line even when count is large', () => {
        const { getByText } = render(
            <GroupTotalsCard
                totalSpent={[]}
                unsettled={[]}
                expenseCount={5}
                defaultCurrency="USD"
            />,
        );
        expect(getByText(/balances\.expenseCount/i)).toBeTruthy();
    });

    it('sorts currencies with the group default first', () => {
        const { getAllByText } = render(
            <GroupTotalsCard
                totalSpent={[
                    { currency: 'ILS', amount: 1200 },
                    { currency: 'USD', amount: 450 },
                ]}
                unsettled={[]}
                expenseCount={0}
                defaultCurrency="USD"
            />,
        );
        const matches = getAllByText(/USD 450\.00|ILS 1200\.00/);
        // USD line should appear before ILS line in DOM order.
        expect(matches[0].props.children).toContain('USD 450.00');
    });
});
