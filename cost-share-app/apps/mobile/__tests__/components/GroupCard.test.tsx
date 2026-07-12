import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GroupCard } from '../../components/GroupCard';
import type { GroupRollup, GroupWithMembers } from '@cost-share/shared';

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

    it('renders group type label via i18n key and member count', () => {
        const { getByText } = render(
            <GroupCard group={baseGroup} onPress={() => {}} />,
        );
        expect(getByText(/groups\.types\.trip/)).toBeTruthy();
        expect(getByText(/groups\.memberCount/)).toBeTruthy();
    });

    it('renders a settled chip when no rollup is provided', () => {
        const { getByText } = render(
            <GroupCard group={baseGroup} onPress={() => {}} />,
        );
        expect(getByText('groups.card.settled')).toBeTruthy();
    });

    it('renders an "owed" chip when primary.net > 0', () => {
        const { getByText } = render(
            <GroupCard
                group={baseGroup}
                rollup={rollupOf({ currency: 'EUR', net: 42.5 })}
                onPress={() => {}}
            />,
        );
        expect(getByText(/\+EUR\s*42\.50/)).toBeTruthy();
    });

    it('renders an "owe" chip when primary.net < 0', () => {
        const { getByText } = render(
            <GroupCard
                group={baseGroup}
                rollup={rollupOf({ currency: 'EUR', net: -10 })}
                onPress={() => {}}
            />,
        );
        expect(getByText(/EUR\s*10\.00/)).toBeTruthy();
    });

    it('appends "+N" when the rollup has additional non-zero currencies', () => {
        const { getByTestId } = render(
            <GroupCard
                group={baseGroup}
                rollup={rollupOf({ currency: 'EUR', net: 50 }, [
                    { currency: 'USD', net: 30 },
                ])}
                onPress={() => {}}
            />,
        );
        expect(getByTestId('balance-chip-others').props.children).toBe('+1');
    });

    it('shows "incl. {names}" subtitle when matchedMemberNames is set', () => {
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
