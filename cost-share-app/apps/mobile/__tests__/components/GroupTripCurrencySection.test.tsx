import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithQuery } from '../helpers/renderWithQuery';
import { GroupTripCurrencySection } from '../../components/balances/GroupTripCurrencySection';

jest.mock('../../hooks/queries/useExchangeRatesQuery', () => ({
    useExchangeRatesQuery: () => ({
        data: { date: '2026-01-01', rates: { USD: 1, EUR: 0.9 } },
    }),
}));

describe('GroupTripCurrencySection', () => {
    const debts = [
        { fromUserId: 'a', toUserId: 'b', currency: 'USD', amount: 10 },
        { fromUserId: 'b', toUserId: 'c', currency: 'EUR', amount: 5 },
    ];

    it('shows upsell when Pro locked', () => {
        const onUpgrade = jest.fn();
        const { getByText } = renderWithQuery(
            <GroupTripCurrencySection
                defaultCurrency="USD"
                debts={debts}
                memberNames={{ a: 'A', b: 'B', c: 'C' }}
                enabled={false}
                onUpgrade={onUpgrade}
            />,
        );
        fireEvent.press(getByText('pro.tripCurrency.upgrade'));
        expect(onUpgrade).toHaveBeenCalled();
    });

    it('renders converted rows when unlocked', () => {
        const { getByText } = renderWithQuery(
            <GroupTripCurrencySection
                defaultCurrency="USD"
                debts={debts}
                memberNames={{ a: 'A', b: 'B', c: 'C' }}
                enabled
                onUpgrade={jest.fn()}
            />,
        );
        expect(getByText('Trip currency view')).toBeTruthy();
    });
});
