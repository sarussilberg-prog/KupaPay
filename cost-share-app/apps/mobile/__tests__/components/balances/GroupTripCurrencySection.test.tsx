import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { GroupTripCurrencySection } from '../../../components/balances/GroupTripCurrencySection';

jest.mock('../../../hooks/queries/useExchangeRatesQuery', () => ({
    useExchangeRatesQuery: () => ({
        data: { rates: { USD: 1, EUR: 0.9 } },
    }),
}));

describe('GroupTripCurrencySection', () => {
    const debts = [
        { fromUserId: 'a', toUserId: 'b', currency: 'USD', amount: 10 },
        { fromUserId: 'a', toUserId: 'b', currency: 'EUR', amount: 5 },
    ];

    it('shows upsell when Pro perk is locked', () => {
        const onUpgrade = jest.fn();
        const { getByText } = render(
            <GroupTripCurrencySection
                defaultCurrency="USD"
                debts={debts}
                memberNames={{ a: 'Alice', b: 'Bob' }}
                enabled={false}
                onUpgrade={onUpgrade}
            />,
        );
        expect(getByText('pro.tripCurrency.title')).toBeTruthy();
        fireEvent.press(getByText('pro.tripCurrency.upgrade'));
        expect(onUpgrade).toHaveBeenCalled();
    });

    it('renders converted rows when unlocked', () => {
        const { getByText } = render(
            <GroupTripCurrencySection
                defaultCurrency="USD"
                debts={debts}
                memberNames={{ a: 'Alice', b: 'Bob' }}
                enabled
                onUpgrade={() => {}}
            />,
        );
        expect(getByText('pro.tripCurrency.pickerLabel')).toBeTruthy();
    });
});
