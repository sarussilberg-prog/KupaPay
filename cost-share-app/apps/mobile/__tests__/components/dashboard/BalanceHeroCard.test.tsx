import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BalanceHeroCard } from '../../../components/dashboard/BalanceHeroCard';

const single = { totalOwed: 50, totalOwedToUser: 100, defaultCurrency: 'USD',
    byCurrency: [{ currency: 'USD', owed: 50, owedToUser: 100 }] };
const multi = { totalOwed: null, totalOwedToUser: null, defaultCurrency: 'USD',
    byCurrency: [{ currency: 'USD', owed: 0, owedToUser: 100 }, { currency: 'ILS', owed: 150, owedToUser: 0 }] };

describe('BalanceHeroCard', () => {
    it('renders headline numbers when single currency', () => {
        const { getByText } = render(<BalanceHeroCard summary={single as any} />);
        expect(getByText('dashboard.youOwe')).toBeTruthy();
        expect(getByText(/50\.00/)).toBeTruthy();
        expect(getByText(/100\.00/)).toBeTruthy();
    });

    it('renders em-dash and breakdown by default when multi-currency', () => {
        const { getAllByText, getByText } = render(<BalanceHeroCard summary={multi as any} />);
        expect(getAllByText('—').length).toBeGreaterThanOrEqual(2);
        expect(getByText('ILS')).toBeTruthy();
    });

    it('toggles breakdown for single currency', () => {
        const { getByTestId, getByText } = render(<BalanceHeroCard summary={single as any} />);
        fireEvent.press(getByTestId('balance-hero-toggle'));
        expect(getByText('USD')).toBeTruthy();
    });
});
