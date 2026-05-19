import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FriendBalanceRow } from '../../../components/dashboard/FriendBalanceRow';

const base = { userId: 'u2', name: 'Bob', avatarUrl: undefined, currency: 'USD', sharedGroupIds: ['g1'] };

describe('FriendBalanceRow', () => {
    it('renders amount when friend owes you', () => {
        const { getByText } = render(<FriendBalanceRow friend={{ ...base, netBalance: 25 }} onPress={() => {}} />);
        expect(getByText('Bob')).toBeTruthy();
        expect(getByText(/25\.00/)).toBeTruthy();
    });

    it('shows settled state at zero', () => {
        const { getByText } = render(<FriendBalanceRow friend={{ ...base, netBalance: 0 }} onPress={() => {}} />);
        expect(getByText('dashboard.settled')).toBeTruthy();
    });

    it('triggers onPress with friend data', () => {
        const onPress = jest.fn();
        const friend = { ...base, netBalance: 5 };
        const { getByText } = render(<FriendBalanceRow friend={friend} onPress={onPress} />);
        fireEvent.press(getByText('Bob'));
        expect(onPress).toHaveBeenCalledWith(friend);
    });
});
