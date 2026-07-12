import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import type { GroupRollup } from '@cost-share/shared';
import { SummaryBalanceStrip } from '../../components/groupDetail/SummaryBalanceStrip';

const rollupOf = (
    primary: { currency: string; net: number },
    others: { currency: string; net: number }[] = [],
): GroupRollup => ({ groupId: 'g1', primary, others });

describe('SummaryBalanceStrip', () => {
    it('renders the owed copy when net is positive', () => {
        const { getByText } = render(
            <SummaryBalanceStrip
                rollup={rollupOf({ currency: 'USD', net: 42 })}
                onPress={() => {}}
            />,
        );
        expect(getByText(/USD 42(\.00)?\b/)).toBeTruthy();
        expect(getByText(/credit/i)).toBeTruthy();
    });

    it('renders the owe copy when net is negative', () => {
        const { getByText } = render(
            <SummaryBalanceStrip
                rollup={rollupOf({ currency: 'USD', net: -10 })}
                onPress={() => {}}
            />,
        );
        expect(getByText(/USD 10(\.00)?\b/)).toBeTruthy();
        expect(getByText(/owe/i)).toBeTruthy();
    });

    it('renders the settled copy when rollup is undefined', () => {
        const { queryByText, getByText } = render(
            <SummaryBalanceStrip onPress={() => {}} />,
        );
        expect(getByText(/settled/i)).toBeTruthy();
        expect(queryByText(/USD 0/)).toBeNull();
    });

    it('shows an unavailable copy (NOT settled) when balance data is missing', () => {
        const { getByTestId, queryByText } = render(
            <SummaryBalanceStrip balanceUnknown onPress={() => {}} />,
        );
        expect(getByTestId('summary-balance-unknown')).toBeTruthy();
        expect(queryByText('groups.card.settled')).toBeNull();
    });

    it('shows the real balance even if balanceUnknown is set', () => {
        const { getByText, queryByTestId } = render(
            <SummaryBalanceStrip
                balanceUnknown
                rollup={rollupOf({ currency: 'USD', net: 42 })}
                onPress={() => {}}
            />,
        );
        expect(getByText(/USD 42(\.00)?\b/)).toBeTruthy();
        expect(queryByTestId('summary-balance-unknown')).toBeNull();
    });

    it('calls onPress when tapped', () => {
        const onPress = jest.fn();
        const { getByTestId } = render(
            <SummaryBalanceStrip
                rollup={rollupOf({ currency: 'USD', net: 42 })}
                onPress={onPress}
                testID="strip"
            />,
        );
        fireEvent.press(getByTestId('strip'));
        expect(onPress).toHaveBeenCalledTimes(1);
    });
});
