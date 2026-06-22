import React from 'react';
import { render } from '@testing-library/react-native';
import type { GroupRollup } from '@cost-share/shared';
import { BalanceChip } from '../../components/BalanceChip';

const rollupOf = (
    primary: { currency: string; net: number },
    others: { currency: string; net: number }[] = [],
): GroupRollup => ({ groupId: 'g1', primary, others });

describe('BalanceChip', () => {
    it('shows Settled label when rollup is undefined', () => {
        const { getByText } = render(<BalanceChip defaultCurrency="USD" />);
        expect(getByText('groups.card.settled')).toBeTruthy();
    });

    it('shows an unknown placeholder (NOT Settled) when balance data is unavailable', () => {
        const { getByTestId, queryByText } = render(
            <BalanceChip defaultCurrency="USD" balanceUnknown />,
        );
        // Never claim "settled" when we simply don't have the data (offline,
        // no cache) — show a neutral placeholder instead.
        expect(getByTestId('balance-chip-unknown')).toBeTruthy();
        expect(queryByText('groups.card.settled')).toBeNull();
        expect(queryByText('groups.card.youSettled')).toBeNull();
    });

    it('ignores balanceUnknown once a real rollup is present', () => {
        const { getByText, queryByTestId } = render(
            <BalanceChip
                defaultCurrency="USD"
                balanceUnknown
                rollup={rollupOf({ currency: 'USD', net: 12 })}
            />,
        );
        expect(getByText('+USD 12.00')).toBeTruthy();
        expect(queryByTestId('balance-chip-unknown')).toBeNull();
    });

    it('shows Settled label when primary net rounds to zero', () => {
        const { getByText } = render(
            <BalanceChip
                defaultCurrency="USD"
                rollup={rollupOf({ currency: 'USD', net: 0.004 })}
            />,
        );
        expect(getByText('groups.card.settled')).toBeTruthy();
    });

    it('shows "You are settled" when the group has open debts among others', () => {
        const { getByText } = render(
            <BalanceChip defaultCurrency="USD" groupHasOpenDebts />,
        );
        expect(getByText('groups.card.youSettled')).toBeTruthy();
    });

    it('still shows "Settled" when groupHasOpenDebts is false', () => {
        const { getByText } = render(
            <BalanceChip defaultCurrency="USD" groupHasOpenDebts={false} />,
        );
        expect(getByText('groups.card.settled')).toBeTruthy();
    });

    it('shows signed amount, not "You are settled", when the user has a non-zero net even if group has open debts', () => {
        const { getByText } = render(
            <BalanceChip
                defaultCurrency="USD"
                rollup={rollupOf({ currency: 'USD', net: 12 })}
                groupHasOpenDebts
            />,
        );
        expect(getByText('+USD 12.00')).toBeTruthy();
    });

    it('formats a positive primary with + and its currency', () => {
        const { getByText } = render(
            <BalanceChip
                defaultCurrency="USD"
                rollup={rollupOf({ currency: 'ILS', net: 17 })}
            />,
        );
        expect(getByText('+ILS 17.00')).toBeTruthy();
    });

    it('formats a negative primary using an absolute value', () => {
        const { getByText } = render(
            <BalanceChip
                defaultCurrency="USD"
                rollup={rollupOf({ currency: 'USD', net: -8.5 })}
            />,
        );
        expect(getByText('−USD 8.50')).toBeTruthy();
    });

    it('appends "+N" when there are additional non-zero currencies', () => {
        const { getByText, getByTestId } = render(
            <BalanceChip
                defaultCurrency="USD"
                rollup={rollupOf({ currency: 'USD', net: 50 }, [
                    { currency: 'EUR', net: 30 },
                    { currency: 'ILS', net: 12 },
                ])}
            />,
        );
        expect(getByText('+USD 50.00')).toBeTruthy();
        expect(getByTestId('balance-chip-others').props.children).toBe('+2');
    });

    it('ignores zero-net others when counting the "+N" badge', () => {
        const { queryByTestId } = render(
            <BalanceChip
                defaultCurrency="USD"
                rollup={rollupOf({ currency: 'USD', net: 50 }, [
                    { currency: 'EUR', net: 0 },
                ])}
            />,
        );
        expect(queryByTestId('balance-chip-others')).toBeNull();
    });
});
