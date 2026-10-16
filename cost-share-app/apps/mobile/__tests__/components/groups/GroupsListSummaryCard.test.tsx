import React from 'react';
import { render } from '@testing-library/react-native';
import { GroupsListSummaryCard } from '../../../components/groups/GroupsListSummaryCard';
import type { BalanceSummary } from '@cost-share/shared';

const baseSummary: BalanceSummary = {
    totalOwed: 10,
    totalOwedToUser: 40,
    defaultCurrency: 'USD',
    byCurrency: [
        { currency: 'USD', owed: 10, owedToUser: 40 },
        { currency: 'AFN', owed: 0, owedToUser: 138.75 },
    ],
};

describe('GroupsListSummaryCard', () => {
    it('renders nothing when balance is unknown', () => {
        const { toJSON } = render(
            <GroupsListSummaryCard summary={baseSummary} balanceUnknown />,
        );
        expect(toJSON()).toBeNull();
    });

    it('renders headline amount and foreign currency line', () => {
        const { getByTestId, getByText } = render(
            <GroupsListSummaryCard summary={baseSummary} />,
        );
        expect(getByTestId('groups-list-summary-card')).toBeTruthy();
        expect(getByTestId('groups-list-summary-amount')).toBeTruthy();
        expect(getByTestId('groups-list-summary-foreign')).toBeTruthy();
        expect(getByText(/groups\.listSummary\.otherCurrenciesLine/)).toBeTruthy();
    });
});
