import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GroupCard } from '../../components/GroupCard';
import type { GroupWithMembers } from '@cost-share/shared';
import { rollupOf } from '../../testUtils/groupRollup';
import {
    GROUP_CARD_CHIP_MAX_WIDTH,
    groupCardBalanceColumnStyle,
    resolveGroupCardUsesStackedBalance,
} from '../../components/groupCardLayout';

const mockUseWindowDimensions = jest.fn(() => ({
    width: 430,
    height: 800,
    scale: 2,
    fontScale: 1,
}));

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
    default: () => mockUseWindowDimensions(),
}));

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: jest.fn() }),
}));

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

    it('renders meta line when timestamp exists', () => {
        const { getByTestId } = render(
            <GroupCard group={baseGroup} onPress={() => {}} />,
        );
        expect(getByTestId('group-card-meta')).toBeTruthy();
        expect(getByTestId('group-card-meta-updated')).toBeTruthy();
    });

    it('renders a settled chip when no rollup is provided', () => {
        const { getByText } = render(
            <GroupCard group={baseGroup} onPress={() => {}} />,
        );
        expect(getByText('groups.card.settled')).toBeTruthy();
    });

    it('uses a width-scaled centered balance column on inline layouts', () => {
        mockUseWindowDimensions.mockReturnValue({
            width: 430,
            height: 800,
            scale: 2,
            fontScale: 1,
        });
        const { getByTestId } = render(
            <GroupCard group={baseGroup} onPress={() => {}} />,
        );
        expect(resolveGroupCardUsesStackedBalance(430)).toBe(false);
        const column = getByTestId('group-card-balance-column');
        const expected = groupCardBalanceColumnStyle(430);
        expect(column.props.style.width).toBe(expected.width);
        expect(column.props.style.alignItems).toBe('center');
        expect(expected.width).toBe(GROUP_CARD_CHIP_MAX_WIDTH);
    });

    it('stacks the balance chip under the title on narrow widths', () => {
        mockUseWindowDimensions.mockReturnValue({
            width: 320,
            height: 800,
            scale: 2,
            fontScale: 1,
        });
        const { getByTestId } = render(
            <GroupCard group={baseGroup} onPress={() => {}} />,
        );
        expect(resolveGroupCardUsesStackedBalance(320)).toBe(true);
        const column = getByTestId('group-card-balance-column');
        expect(column.props.style.alignSelf).toBe('flex-end');
    });

    it('renders localized owed chip when primary.net > 0', () => {
        const { getByText, getByTestId } = render(
            <GroupCard
                group={baseGroup}
                rollup={rollupOf({ currency: 'EUR', net: 42.5 })}
                onPress={() => {}}
            />,
        );
        expect(getByText('groups.card.owedToYouCaption')).toBeTruthy();
        expect(getByTestId('balance-chip-amount')).toBeTruthy();
    });

    it('renders localized owe chip when primary.net < 0', () => {
        const { getByText, getByTestId } = render(
            <GroupCard
                group={baseGroup}
                rollup={rollupOf({ currency: 'ILS', net: -761.5 })}
                onPress={() => {}}
            />,
        );
        expect(getByText('groups.card.youOweCaption')).toBeTruthy();
        expect(getByTestId('balance-chip-amount')).toBeTruthy();
    });

    it('shows localized multi-currency affordance', () => {
        const { getByTestId } = render(
            <GroupCard
                group={baseGroup}
                rollup={rollupOf({ currency: 'EUR', net: 50 }, [
                    { currency: 'USD', net: 30 },
                ])}
                onPress={() => {}}
            />,
        );
        expect(getByTestId('balance-chip-others')).toBeTruthy();
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
