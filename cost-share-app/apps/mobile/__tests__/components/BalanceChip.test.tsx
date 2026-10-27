import React from 'react';
import { render } from '@testing-library/react-native';
import { BalanceChip } from '../../components/BalanceChip';
import { rollupOf } from '../../testUtils/groupRollup';

describe('BalanceChip', () => {
    it('shows Settled label when rollup is undefined', () => {
        const { getByText } = render(<BalanceChip defaultCurrency="USD" />);
        expect(getByText('groups.card.settled')).toBeTruthy();
    });

    it('shows an unknown placeholder (NOT Settled) when balance data is unavailable', () => {
        const { getByTestId, queryByText } = render(
            <BalanceChip defaultCurrency="USD" balanceUnknown />,
        );
        expect(getByTestId('balance-chip-unknown')).toBeTruthy();
        expect(queryByText('groups.card.settled')).toBeNull();
        expect(queryByText('groups.card.youSettled')).toBeNull();
    });

    it('ignores balanceUnknown once a real rollup is present', () => {
        const { getByTestId, queryByTestId } = render(
            <BalanceChip
                defaultCurrency="USD"
                balanceUnknown
                rollup={rollupOf({ currency: 'USD', net: 12 })}
            />,
        );
        expect(getByTestId('balance-chip-active')).toBeTruthy();
        expect(queryByTestId('balance-chip-unknown')).toBeNull();
    });

    it('shows Settled label when primary net rounds to zero', () => {
        const { getByTestId } = render(
            <BalanceChip
                defaultCurrency="USD"
                rollup={rollupOf({ currency: 'USD', net: 0.004 })}
            />,
        );
        expect(getByTestId('balance-chip-settled')).toBeTruthy();
    });

    it('shows "You are settled" when the group has open debts among others', () => {
        const { getByText } = render(
            <BalanceChip defaultCurrency="USD" groupHasOpenDebts />,
        );
        expect(getByText('groups.card.youSettled')).toBeTruthy();
    });

    it('shows localized owe copy when primary net is negative', () => {
        const { getByText, getByTestId } = render(
            <BalanceChip
                defaultCurrency="USD"
                rollup={rollupOf({ currency: 'ILS', net: -761.5 })}
            />,
        );
        expect(getByText('groups.card.youOweCaption')).toBeTruthy();
        expect(getByTestId('balance-chip-amount')).toBeTruthy();
    });

    it('shows localized owed copy when primary net is positive', () => {
        const { getByText, getByTestId } = render(
            <BalanceChip
                defaultCurrency="USD"
                rollup={rollupOf({ currency: 'EUR', net: 42.5 })}
            />,
        );
        expect(getByText('groups.card.owedToYouCaption')).toBeTruthy();
        const amount = getByTestId('balance-chip-amount');
        expect(amount).toBeTruthy();
        expect(String(amount.props.children)).not.toMatch(/\+/);
    });

    it('shows a subtle extra-currency hint when FX conversion failed', () => {
        const { getByTestId } = render(
            <BalanceChip
                defaultCurrency="USD"
                rollup={rollupOf({ currency: 'USD', net: 50 }, [
                    { currency: 'EUR', net: 30 },
                    { currency: 'ILS', net: 12 },
                ])}
            />,
        );
        const others = getByTestId('balance-chip-others');
        expect(String(others.props.children)).toMatch(/\(2/);
        expect(String(others.props.children)).toMatch(/groups\.card\.moreCurrenciesNoun/);
    });

    it('ignores zero-net others when counting extra currencies', () => {
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

    it('hides extra-currency link when FX total includes every leg', () => {
        const { queryByTestId } = render(
            <BalanceChip
                defaultCurrency="USD"
                displayCurrency="ILS"
                ratesFromBase={{ USD: 0.27, EUR: 0.25 }}
                rollup={rollupOf({ currency: 'ILS', net: -100 }, [
                    { currency: 'USD', net: -27 },
                ])}
            />,
        );
        expect(queryByTestId('balance-chip-others')).toBeNull();
    });

    it('ignores others in the same currency as primary', () => {
        const { queryByTestId } = render(
            <BalanceChip
                defaultCurrency="USD"
                rollup={rollupOf({ currency: 'USD', net: 50 }, [
                    { currency: 'USD', net: 20 },
                    { currency: 'EUR', net: 0 },
                ])}
            />,
        );
        expect(queryByTestId('balance-chip-others')).toBeNull();
    });
});
