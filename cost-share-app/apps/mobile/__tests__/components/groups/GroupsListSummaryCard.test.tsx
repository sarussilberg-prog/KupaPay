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

    it('renders a single converted headline without a foreign amount line', () => {
        const { getByTestId, queryByTestId } = render(
            <GroupsListSummaryCard
                summary={baseSummary}
                conversion={{ isConverted: true, ratesDate: '2026-01-01', isLoading: false, failed: false }}
            />,
        );
        expect(getByTestId('groups-list-summary-card')).toBeTruthy();
        expect(getByTestId('groups-list-summary-amount')).toBeTruthy();
        expect(queryByTestId('groups-list-summary-foreign-hint')).toBeNull();
    });

    it('shows a subtle FX-failure hint without raw foreign amounts', () => {
        const { getByTestId, getByText } = render(
            <GroupsListSummaryCard
                summary={baseSummary}
                conversion={{ isConverted: false, ratesDate: null, isLoading: false, failed: true }}
            />,
        );
        expect(getByTestId('groups-list-summary-foreign-hint')).toBeTruthy();
        expect(getByText(/groups\.listSummary\.otherCurrenciesHint/)).toBeTruthy();
    });
});
