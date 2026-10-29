/**
 * Ensures stack screens tolerate undefined route.params (deep links, notification taps).
 * Tests fail if guards are removed and screens destructure `route.params` directly.
 */

import React from 'react';
import { renderWithQuery } from '../helpers/renderWithQuery';
import { queryClient } from '../../lib/queryClient';

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useNavigation: () => ({
            navigate: jest.fn(),
            goBack: mockGoBack,
            canGoBack: () => true,
            setOptions: jest.fn(),
            replace: jest.fn(),
        }),
        useRoute: () => ({ params: undefined }),
        useFocusEffect: (cb: () => void) => cb(),
        useIsFocused: () => true,
    };
});

jest.mock('../../services/expenses.service', () => ({
    getExpenseWithSplits: jest.fn(),
    fetchGroupExpenses: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../services/groups.service', () => ({
    getGroupMembers: jest.fn().mockResolvedValue([]),
    getGroupById: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../services/settlements.service', () => ({
    fetchSettlements: jest.fn().mockResolvedValue([]),
    fetchConsolidationBatches: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../services/users.service', () => ({
    fetchGroupUsers: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../hooks/queries/useAdminSentryQueries', () => ({
    useSentryIssueDetailQuery: () => ({
        isLoading: false,
        data: null,
        refetch: jest.fn(),
        isRefetching: false,
    }),
    useSentryIssueEventsQuery: () => ({
        data: [],
        refetch: jest.fn(),
        isRefetching: false,
    }),
}));

import { ExpenseListScreen } from '../../screens/expenses/ExpenseListScreen';
import { GroupMembersScreen } from '../../screens/groups/GroupMembersScreen';
import { SettlementHistoryScreen } from '../../screens/balances/SettlementHistoryScreen';
import { AdminErrorDetailScreen } from '../../screens/admin/AdminErrorDetailScreen';
import { GroupPostCreateInviteScreen } from '../../screens/groups/GroupPostCreateInviteScreen';

beforeEach(() => {
    queryClient.clear();
    mockGoBack.mockClear();
});

describe('stack screens with undefined route.params', () => {
    it.each([
        ['ExpenseListScreen', ExpenseListScreen],
        ['GroupMembersScreen', GroupMembersScreen],
        ['SettlementHistoryScreen', SettlementHistoryScreen],
        ['AdminErrorDetailScreen', AdminErrorDetailScreen],
        ['GroupPostCreateInviteScreen', GroupPostCreateInviteScreen],
    ] as const)('%s renders route-params fallback instead of throwing', (_, Screen) => {
        const { getByTestId } = renderWithQuery(<Screen />);
        expect(getByTestId('route-params-fallback')).toBeTruthy();
    });
});
