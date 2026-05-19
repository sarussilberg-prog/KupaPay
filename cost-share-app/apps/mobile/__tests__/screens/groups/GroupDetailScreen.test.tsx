import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
        useRoute: () => ({ params: { groupId: 'g1' } }),
        useFocusEffect: (cb: () => void) => cb(),
        useIsFocused: () => true,
    };
});

jest.mock('../../../services/groups.service', () => ({
    getGroupById: jest.fn(),
    getGroupMembers: jest.fn(),
    getGroupSummary: jest.fn(),
    getGroupBalances: jest.fn(),
    deleteGroup: jest.fn(),
}));

jest.mock('../../../services/expenses.service', () => ({
    fetchExpenses: jest.fn().mockResolvedValue([]),
}));

import { GroupDetailScreen } from '../../../screens/groups/GroupDetailScreen';
import {
    getGroupById,
    getGroupMembers,
    getGroupSummary,
    getGroupBalances,
} from '../../../services/groups.service';
import { useAppStore } from '../../../store';

const mockGetGroup = getGroupById as jest.MockedFunction<typeof getGroupById>;
const mockGetMembers = getGroupMembers as jest.MockedFunction<typeof getGroupMembers>;
const mockGetSummary = getGroupSummary as jest.MockedFunction<typeof getGroupSummary>;
const mockGetBalances = getGroupBalances as jest.MockedFunction<typeof getGroupBalances>;

const group = {
    id: 'g1',
    name: 'Trip',
    description: 'Group desc',
    groupType: 'trip' as const,
    defaultCurrency: 'USD',
    createdBy: 'u1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
};

beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockGetGroup.mockReset();
    mockGetMembers.mockReset();
    mockGetSummary.mockReset();
    mockGetBalances.mockReset();
    useAppStore.setState({ expenses: [] });
});

describe('GroupDetailScreen', () => {
    it('renders the group name and description', async () => {
        mockGetGroup.mockResolvedValueOnce(group);
        mockGetMembers.mockResolvedValueOnce([]);
        mockGetSummary.mockResolvedValueOnce({
            groupId: 'g1',
            groupName: 'Trip',
            memberCount: 2,
            expenseCount: 3,
            totalSpent: 150,
        } as any);
        mockGetBalances.mockResolvedValueOnce([]);
        const { findByText } = render(<GroupDetailScreen />);
        expect(await findByText('Trip')).toBeTruthy();
        expect(await findByText('Group desc')).toBeTruthy();
    });

    it('navigates to AddExpense when add expense is pressed', async () => {
        mockGetGroup.mockResolvedValueOnce(group);
        mockGetMembers.mockResolvedValueOnce([]);
        mockGetSummary.mockResolvedValueOnce(null);
        mockGetBalances.mockResolvedValueOnce([]);
        const { findByText } = render(<GroupDetailScreen />);
        fireEvent.press(await findByText('expenses.addExpense'));
        expect(mockNavigate).toHaveBeenCalledWith('AddExpense', { groupId: 'g1' });
    });

    it('navigates to Balances on balances button press', async () => {
        mockGetGroup.mockResolvedValueOnce(group);
        mockGetMembers.mockResolvedValueOnce([]);
        mockGetSummary.mockResolvedValueOnce(null);
        mockGetBalances.mockResolvedValueOnce([]);
        const { findAllByText } = render(<GroupDetailScreen />);
        const balanceButtons = await findAllByText('groups.balances');
        fireEvent.press(balanceButtons[balanceButtons.length - 1]);
        expect(mockNavigate).toHaveBeenCalledWith('Balances', { groupId: 'g1' });
    });
});
