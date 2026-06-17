import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import type { FriendBalanceSummary } from '@cost-share/shared';
import { FriendBalanceRow } from '../../../components/dashboard/FriendBalanceRow';

const friendOf = (
    byCurrency: { currency: string; net: number }[],
): FriendBalanceSummary => ({
    userId: 'u2',
    name: 'Bob',
    avatarUrl: null,
    isActive: true,
    sharedGroupIds: ['g1'],
    byCurrency,
});

describe('FriendBalanceRow', () => {
    it('renders avatar and amount when friend owes you', () => {
        const friend = friendOf([{ currency: 'USD', net: 25 }]);
        const { getByText, getByTestId } = render(
            <FriendBalanceRow friend={friend} onPress={() => {}} testID="friend-u2" />,
        );
        expect(getByText('Bob')).toBeTruthy();
        expect(getByTestId('friend-u2-avatar')).toBeTruthy();
        expect(getByText(/25\.00/)).toBeTruthy();
        expect(getByText('dashboard.owesYou')).toBeTruthy();
    });

    it('shows youOwe subtitle when net is negative', () => {
        const friend = friendOf([{ currency: 'USD', net: -10 }]);
        const { getByText } = render(
            <FriendBalanceRow friend={friend} onPress={() => {}} />,
        );
        expect(getByText('dashboard.youOweFriend')).toBeTruthy();
        expect(getByText(/10\.00/)).toBeTruthy();
    });

    it('renders the largest currency as headline and "+N" for the rest', () => {
        const friend = friendOf([
            { currency: 'USD', net: 5 },
            { currency: 'EUR', net: 30 },
            { currency: 'ILS', net: -2 },
        ]);
        const { getByText, getByTestId } = render(
            <FriendBalanceRow friend={friend} onPress={() => {}} testID="friend-u2" />,
        );
        expect(getByText(/30\.00/)).toBeTruthy();
        expect(getByTestId('friend-u2-extra-count')).toBeTruthy();
    });

    it('triggers onPress with friend data', () => {
        const friend = friendOf([{ currency: 'USD', net: 25 }]);
        const onPress = jest.fn();
        const { getByText } = render(
            <FriendBalanceRow friend={friend} onPress={onPress} />,
        );
        fireEvent.press(getByText('Bob'));
        expect(onPress).toHaveBeenCalledWith(friend);
    });
});
