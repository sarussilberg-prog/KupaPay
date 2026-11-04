import React from 'react';
import { render } from '@testing-library/react-native';
import { GroupsListSummaryCard } from '../../../components/groups/GroupsListSummaryCard';
import { RtlLayoutProvider } from '../../../hooks/useRtlLayout';
import type { BalanceSummary } from '@cost-share/shared';

jest.mock('../../../store', () => ({
    useAppStore: (selector: (state: { language: 'he' | 'en' }) => unknown) =>
        selector({ language: 'he' }),
}));

function renderSummary(ui: React.ReactElement) {
    return render(<RtlLayoutProvider>{ui}</RtlLayoutProvider>);
}

function flattenStyle(style: unknown): Record<string, unknown> {
    if (!style) return {};
    if (Array.isArray(style)) {
        return Object.assign({}, ...style.map(flattenStyle));
    }
    return style as Record<string, unknown>;
}

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
        const { getByTestId, queryByTestId } = renderSummary(
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
        const { getByTestId, getByText } = renderSummary(
            <GroupsListSummaryCard
                summary={baseSummary}
                conversion={{ isConverted: false, ratesDate: null, isLoading: false, failed: true }}
            />,
        );
        expect(getByTestId('groups-list-summary-foreign-hint')).toBeTruthy();
        expect(getByText(/groups\.listSummary\.otherCurrenciesHint/)).toBeTruthy();
    });

    it('uses logical start alignment (textAlign auto, flex-start column) for label and amount', () => {
        const { getByTestId } = renderSummary(
            <GroupsListSummaryCard
                summary={baseSummary}
                conversion={{ isConverted: true, ratesDate: '2026-01-01', isLoading: false, failed: false }}
            />,
        );

        const content = getByTestId('groups-list-summary-content');
        expect(flattenStyle(content.props.style).alignItems).toBe('flex-start');

        const labelStyle = flattenStyle(getByTestId('groups-list-summary-label').props.style);
        expect(labelStyle.textAlign).toBe('auto');
        expect(labelStyle.writingDirection).toBe('rtl');

        const amount = getByTestId('groups-list-summary-amount');
        expect(amount.props.className).not.toContain('text-center');
        const amountStyle = flattenStyle(amount.props.style);
        expect(amountStyle.textAlign).toBe('auto');
        expect(amountStyle.writingDirection).toBe('rtl');
    });
});
