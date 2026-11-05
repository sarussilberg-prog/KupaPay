import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import type { FriendBalanceSummary, SimplifiedDebts, Transfer } from '@cost-share/shared';
import { FriendGroupBalancesSheet } from '../../../components/dashboard/FriendGroupBalancesSheet';
import { countVisibleModals, expectAtMostOneVisibleModal } from '../../helpers/modalTestUtils';

jest.mock('../../../hooks/useSimplifiedDebts');
jest.mock('../../../hooks/queries/useExchangeRatesQuery', () => ({
    useExchangeRatesQuery: () => ({ data: { rates: { USD: 0.27 } } }),
}));
jest.mock('@tanstack/react-query', () => {
    const actual = jest.requireActual('@tanstack/react-query');
    return {
        ...actual,
        useQuery: () => ({
            data: [{ id: 'g1', name: 'Trip', groupType: 'trip', imageUrl: undefined }],
            isLoading: false,
        }),
    };
});

import { useSimplifiedDebts } from '../../../hooks/useSimplifiedDebts';

const mockUseSimplifiedDebts = useSimplifiedDebts as jest.MockedFunction<typeof useSimplifiedDebts>;

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

const multiCurrencyTransfers: Transfer[] = [
    { groupId: 'g1', currency: 'ILS', fromUserId: 'u-friend', toUserId: 'u-me', amount: 100 },
    { groupId: 'g1', currency: 'USD', fromUserId: 'u-me', toUserId: 'u-friend', amount: 27 },
];

describe('FriendGroupBalancesSheet interactions', () => {
    beforeEach(() => {
        mockUseSimplifiedDebts.mockReturnValue({
            data: makeSimplified(multiCurrencyTransfers),
            isLoading: false,
        } as ReturnType<typeof useSimplifiedDebts>);
    });

    it('opens cross-settle confirm with at most one Modal (breakdown hidden)', () => {
        const screen = render(
            <FriendGroupBalancesSheet
                visible
                friend={friend}
                currentUserId="u-me"
                defaultCurrency="ILS"
                onClose={() => {}}
                onSelectGroup={() => {}}
            />,
        );
        expectAtMostOneVisibleModal(screen, 'initial');
        fireEvent.press(screen.getByTestId('friend-settle-all'));
        expectAtMostOneVisibleModal(screen, 'after friend-settle-all');
        expect(screen.queryByTestId('friend-balances-weighted-net')).toBeNull();
        expect(screen.getByTestId('friend-cross-settle-confirm')).toBeTruthy();
    });

    it('friend-settle-one-currency opens pick then confirm and hides breakdown modal', () => {
        const screen = render(
            <FriendGroupBalancesSheet
                visible
                friend={friend}
                currentUserId="u-me"
                defaultCurrency="ILS"
                onClose={() => {}}
                onSelectGroup={() => {}}
            />,
        );
        fireEvent.press(screen.getByTestId('friend-settle-one-currency'));
        expectAtMostOneVisibleModal(screen, 'after friend-settle-one-currency');
        expect(screen.queryByTestId('friend-balances-weighted-net')).toBeNull();
        fireEvent.press(screen.getByTestId('friend-cross-currency-ILS'));
        expect(screen.getByTestId('friend-cross-settle-confirm')).toBeTruthy();
    });

    it('primary settle buttons change UI state when pressed', () => {
        const screen = render(
            <FriendGroupBalancesSheet
                visible
                friend={friend}
                currentUserId="u-me"
                defaultCurrency="ILS"
                onClose={() => {}}
                onSelectGroup={() => {}}
            />,
        );
        expect(countVisibleModals(screen)).toBe(1);
        expect(screen.getByTestId('friend-balances-weighted-net')).toBeTruthy();
        fireEvent.press(screen.getByTestId('friend-settle-all'));
        expect(screen.queryByTestId('friend-balances-weighted-net')).toBeNull();
        expect(screen.getByTestId('friend-cross-settle-confirm')).toBeTruthy();
    });
});
