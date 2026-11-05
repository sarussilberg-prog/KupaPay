import React from 'react';
import { render } from '@testing-library/react-native';
import type { FriendBalanceSummary, SimplifiedDebts, Transfer } from '@cost-share/shared';
import { FriendGroupBalancesSheet } from '../../../components/dashboard/FriendGroupBalancesSheet';

jest.mock('../../../hooks/useSimplifiedDebts');
jest.mock('../../../hooks/queries/useExchangeRatesQuery', () => ({
    useExchangeRatesQuery: () => ({ data: { rates: { USD: 0.27 } } }),
}));
jest.mock('@tanstack/react-query', () => {
    const actual = jest.requireActual('@tanstack/react-query');
    return {
        ...actual,
        useQuery: () => ({ data: [], isLoading: false }),
    };
});

import { useSimplifiedDebts } from '../../../hooks/useSimplifiedDebts';

const mockUseSimplifiedDebts = useSimplifiedDebts as jest.MockedFunction<
    typeof useSimplifiedDebts
>;

const friend: FriendBalanceSummary = {
    userId: 'u-friend',
    name: 'Bob',
    avatarUrl: null,
    isActive: true,
    sharedGroupIds: ['g1'],
    byCurrency: [
        { currency: 'ILS', net: 100 },
        { currency: 'USD', net: -27 },
    ],
};

function makeSimplified(transfers: Transfer[]): SimplifiedDebts {
    const byGroupCurrency = new Map<string, Map<string, Transfer[]>>();
    const gMap = new Map<string, Transfer[]>();
    for (const t of transfers) {
        const list = gMap.get(t.currency) ?? [];
        list.push(t);
        gMap.set(t.currency, list);
    }
    byGroupCurrency.set('g1', gMap);
    return {
        transfers,
        byGroupCurrency,
        userTransfers: transfers,
        groupRollups: new Map(),
        friendBalances: new Map(),
        unbalanced: [],
    };
}

describe('FriendGroupBalancesSheet weighted net header', () => {
    beforeEach(() => {
        mockUseSimplifiedDebts.mockReturnValue({
            data: makeSimplified([
                {
                    groupId: 'g1',
                    currency: 'ILS',
                    fromUserId: 'u-friend',
                    toUserId: 'u-me',
                    amount: 100,
                },
                {
                    groupId: 'g1',
                    currency: 'USD',
                    fromUserId: 'u-me',
                    toUserId: 'u-friend',
                    amount: 27,
                },
            ]),
            isLoading: false,
        } as ReturnType<typeof useSimplifiedDebts>);
    });

    it('shows weighted net block and per-currency lines', () => {
        const { getByTestId, getByText } = render(
            <FriendGroupBalancesSheet
                visible
                friend={friend}
                currentUserId="u-me"
                defaultCurrency="ILS"
                onClose={() => {}}
                onSelectGroup={() => {}}
            />,
        );
        expect(getByTestId('friend-balances-weighted-net')).toBeTruthy();
        expect(getByText('ILS')).toBeTruthy();
        expect(getByText('USD')).toBeTruthy();
    });

    it('shows settle-all footer when cross-group balance is open', () => {
        const { getByTestId } = render(
            <FriendGroupBalancesSheet
                visible
                friend={friend}
                currentUserId="u-me"
                defaultCurrency="ILS"
                onClose={() => {}}
                onSelectGroup={() => {}}
            />,
        );
        expect(getByTestId('friend-settle-all')).toBeTruthy();
    });

    it('shows per-currency rows and settle-in-one-currency when multiple currencies are open', () => {
        const { getByTestId } = render(
            <FriendGroupBalancesSheet
                visible
                friend={friend}
                currentUserId="u-me"
                defaultCurrency="ILS"
                onClose={() => {}}
                onSelectGroup={() => {}}
            />,
        );
        expect(getByTestId('friend-balances-per-currency')).toBeTruthy();
        expect(getByTestId('friend-settle-one-currency')).toBeTruthy();
    });
});

describe('FriendGroupBalancesSheet single open currency', () => {
    beforeEach(() => {
        mockUseSimplifiedDebts.mockReturnValue({
            data: makeSimplified([
                {
                    groupId: 'g1',
                    currency: 'ILS',
                    fromUserId: 'u-friend',
                    toUserId: 'u-me',
                    amount: 42,
                },
            ]),
            isLoading: false,
        } as ReturnType<typeof useSimplifiedDebts>);
    });

    it('shows only the net total without per-currency breakdown or single-currency settle link', () => {
        const singleCurrencyFriend: FriendBalanceSummary = {
            ...friend,
            byCurrency: [{ currency: 'ILS', net: 42 }],
        };
        const { getByTestId, queryByTestId } = render(
            <FriendGroupBalancesSheet
                visible
                friend={singleCurrencyFriend}
                currentUserId="u-me"
                defaultCurrency="ILS"
                onClose={() => {}}
                onSelectGroup={() => {}}
            />,
        );
        expect(getByTestId('friend-balances-weighted-net')).toBeTruthy();
        expect(queryByTestId('friend-balances-per-currency')).toBeNull();
        expect(queryByTestId('friend-settle-one-currency')).toBeNull();
        expect(getByTestId('friend-settle-all')).toBeTruthy();
    });
});
