import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GroupCard } from '../../components/GroupCard';
import type { GroupRollup, GroupWithMembers } from '@cost-share/shared';

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: jest.fn() }),
}));

const rollupOf = (
    primary: { currency: string; net: number },
    others: { currency: string; net: number }[] = [],
): GroupRollup => ({ groupId: 'g1', primary, others });

const baseGroup: GroupWithMembers = {
    id: 'g1',
    name: 'Trip to Paris',
    description: 'Summer trip',
    groupType: 'trip',
    defaultCurrency: 'EUR',
    inviteToken: 'abc1234567',
    createdBy: 'u1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActivityAt: new Date(Date.now() - 86_400_000),
    members: [
        { userId: 'u1', displayName: 'Alice', isActive: true },
        { userId: 'u2', displayName: 'Bob', isActive: true },
    ],
    isArchivedByMe: false,
    isAutoArchived: false,
    hasUnreadNote: false,
};

describe('GroupCard', () => {
    it('renders group name', () => {
        const { getByText } = render(
            <GroupCard group={baseGroup} onPress={() => {}} />,
        );
        expect(getByText('Trip to Paris')).toBeTruthy();
    });

    it('renders member count via IconLabel row', () => {
        const { getByText } = render(
            <GroupCard group={baseGroup} onPress={() => {}} />,
        );
        expect(getByText(/groups\.memberCount/)).toBeTruthy();
    });

    it('renders last activity subtitle when timestamp exists', () => {
        const { getByText } = render(
            <GroupCard group={baseGroup} onPress={() => {}} />,
        );
        expect(getByText(/groups\.card\.lastActivity/)).toBeTruthy();
    });

    it('renders a settled chip when no rollup is provided', () => {
        const { getByText } = render(
            <GroupCard group={baseGroup} onPress={() => {}} />,
        );
        expect(getByText('groups.card.settled')).toBeTruthy();
    });

    it('renders localized owed chip when primary.net > 0', () => {
        const { getByText } = render(
            <GroupCard
                group={baseGroup}
                rollup={rollupOf({ currency: 'EUR', net: 42.5 })}
                onPress={() => {}}
            />,
        );
        expect(getByText(/groups\.card\.owedToYou/)).toBeTruthy();
    });

    it('renders localized owe chip when primary.net < 0', () => {
        const { getByText } = render(
            <GroupCard
                group={baseGroup}
                rollup={rollupOf({ currency: 'ILS', net: -761.5 })}
                onPress={() => {}}
            />,
        );
        expect(getByText(/groups\.card\.youOwe/)).toBeTruthy();
    });

    it('shows localized multi-currency affordance', () => {
        const { getByText } = render(
            <GroupCard
                group={baseGroup}
                rollup={rollupOf({ currency: 'EUR', net: 50 }, [
                    { currency: 'USD', net: 30 },
                ])}
                onPress={() => {}}
            />,
        );
        expect(getByText(/groups\.card\.moreCurrencies/)).toBeTruthy();
    });

    it('shows matched members subtitle when matchedMemberNames is set', () => {
        const { getByText } = render(
            <GroupCard
                group={baseGroup}
                searchQuery="ali"
                matchedMemberNames={['Alice']}
                onPress={() => {}}
            />,
        );
        expect(getByText(/groups\.card\.matchedMembers/)).toBeTruthy();
    });

    it('calls onPress with the group id', () => {
        const onPress = jest.fn();
        const { getByText } = render(
            <GroupCard group={baseGroup} onPress={onPress} />,
        );
        fireEvent.press(getByText('Trip to Paris'));
        expect(onPress).toHaveBeenCalledWith('g1');
    });

    it('renders group image when imageUrl is provided', () => {
        const { getByTestId } = render(
            <GroupCard
                group={{ ...baseGroup, imageUrl: 'https://example.com/group.jpg' }}
                onPress={() => {}}
            />,
        );
        expect(getByTestId('group-avatar-image')).toBeTruthy();
    });

    it('renders emoji avatar fallback for named groups without image', () => {
        const { getByTestId } = render(
            <GroupCard group={baseGroup} onPress={() => {}} />,
        );
        expect(getByTestId('group-avatar-initials')).toBeTruthy();
    });

    it('renders an unread badge when unreadCount > 0', () => {
        const { getByTestId } = render(
            <GroupCard group={baseGroup} unreadCount={4} onPress={() => {}} />,
        );
        expect(getByTestId('unread-badge')).toBeTruthy();
    });

    it('does not render an unread badge when unreadCount is 0 or undefined', () => {
        const { queryByTestId } = render(
            <GroupCard group={baseGroup} onPress={() => {}} />,
        );
        expect(queryByTestId('unread-badge')).toBeNull();
    });
});
