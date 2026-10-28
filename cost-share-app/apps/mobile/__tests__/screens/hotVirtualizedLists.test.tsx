/**
 * Ensures hot paths stay on HotVirtualizedList (FlashList), not raw FlatList.
 */

import React from 'react';
import { waitFor } from '@testing-library/react-native';
import { renderWithQuery as render } from '../helpers/renderWithQuery';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from '../../hooks/queries/keys';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), setParams: jest.fn() }),
        useRoute: () => ({ params: { groupId: 'g1' } }),
        useFocusEffect: jest.fn(),
        useIsFocused: () => true,
    };
});

jest.mock('@react-navigation/bottom-tabs', () => {
    const actual = jest.requireActual('@react-navigation/bottom-tabs');
    return { ...actual, useBottomTabBarHeight: () => 0 };
});

jest.mock('../../services/groups.service', () => ({
    fetchGroups: jest.fn().mockResolvedValue([]),
    fetchGroupById: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../services/simplifiedDebts.service', () => ({
    fetchSimplifiedInputs: jest.fn().mockResolvedValue({ groups: [] }),
}));

jest.mock('../../services/expenses.service', () => ({
    fetchExpenses: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../services/messages.service', () => ({
    fetchMessages: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../services/activity.service', () => ({
    fetchRecentActivity: jest.fn().mockResolvedValue([]),
    fetchActivityLastSeenAt: jest.fn().mockResolvedValue(null),
    ACTIVITY_INITIAL_PAGE_SIZE: 15,
    ACTIVITY_PAGE_SIZE: 20,
    ACTIVITY_INITIAL_SKELETON_COUNT: 3,
}));

jest.mock('../../store', () => ({
    useAppStore: jest.fn(() => ({
        currentUser: { id: 'u1', name: 'Test', avatarUrl: null },
    })),
}));

jest.mock('../../lib/supabase', () => ({
    supabase: {
        rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    },
}));

jest.mock('@shopify/flash-list', () => {
    const React = jest.requireActual('react');
    const ReactNative = jest.requireActual('react-native');
    const { FlatList } = ReactNative;
    return {
        FlashList: React.forwardRef(function FlashListStub(props: Record<string, unknown>, ref: unknown) {
            return <FlatList ref={ref as never} {...props} />;
        }),
    };
});

import { GroupsListScreen } from '../../screens/groups/GroupsListScreen';
import { ExpenseListScreen } from '../../screens/expenses/ExpenseListScreen';
import { ActivityFeedScreen } from '../../screens/activity/ActivityFeedScreen';

beforeEach(() => {
    queryClient.clear();
    mockNavigate.mockClear();
});

describe('hot list virtualization', () => {
    it('GroupsListScreen uses virtualized list', async () => {
        const { findByTestId } = render(<GroupsListScreen />);
        expect(await findByTestId('groups-list-virtualized')).toBeTruthy();
    });

    it('ExpenseListScreen uses virtualized list', async () => {
        queryClient.setQueryData(queryKeys.groupExpenses('g1'), []);
        const { findByTestId } = render(<ExpenseListScreen />);
        expect(await findByTestId('expense-list-virtualized')).toBeTruthy();
    });

    it('ActivityFeedScreen uses virtualized list', async () => {
        const { findByTestId } = render(<ActivityFeedScreen />);
        expect(await findByTestId('activity-feed-virtualized')).toBeTruthy();
    });
});
