import React from 'react';
import { waitFor } from '@testing-library/react-native';
import { renderWithQuery } from '../../helpers/renderWithQuery';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, setOptions: jest.fn() }),
        useRoute: () => ({ params: { groupId: 'deleted-group' } }),
        useIsFocused: () => true,
    };
});

jest.mock('react-native-calendars', () => {
    const React = require('react');
    const { View } = require('react-native');
    function Calendar() {
        return <View testID="mock-calendar" />;
    }
    return { Calendar, LocaleConfig: { locales: {}, defaultLocale: 'en' } };
});

jest.mock('../../../services/expenses.service', () => ({
    createExpense: jest.fn(),
    updateExpense: jest.fn(),
    deleteExpense: jest.fn(),
    getExpenseWithSplits: jest.fn(),
}));

const mockGroupsSeed = [
    {
        id: 'g-live',
        name: 'Live Group',
        defaultCurrency: 'ILS',
        groupType: 'general',
        inviteToken: 'live1234567',
        createdBy: 'u1',
        isActive: true,
        isArchivedByMe: false,
        isAutoArchived: false,
        createdAt: new Date('2026-03-01'),
        updatedAt: new Date('2026-03-01'),
        members: [{ userId: 'u1', displayName: 'Alice', isActive: true }],
    },
];

jest.mock('../../../services/groups.service', () => ({
    getGroupMembers: jest.fn(async (groupId: string) => [
        { id: 'm1', groupId, userId: 'u1', role: 'member', isActive: true, joinedAt: new Date() },
    ]),
    getGroupById: jest.fn(),
    fetchGroups: jest.fn(async () => mockGroupsSeed),
}));

jest.mock('../../../services/users.service', () => ({
    fetchGroupUsers: jest.fn(async () => [
        {
            id: 'u1',
            name: 'Alice',
            email: 'a@x.com',
            inviteToken: 'alice123456',
            defaultCurrency: 'ILS',
            language: 'en',
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true,
            isAdmin: false,
        },
    ]),
}));

import { AddExpenseScreen } from '../../../screens/expenses/AddExpenseScreen';
import { useAppStore } from '../../../store';
import { queryClient } from '../../../lib/queryClient';
import { queryKeys } from '../../../hooks/queries/keys';
import { getGroupMembers } from '../../../services/groups.service';

beforeEach(() => {
    mockNavigate.mockClear();
    queryClient.clear();
    useAppStore.setState({
        favoriteGroupId: 'deleted-group',
        currentUser: {
            id: 'u1',
            email: 'a@x.com',
            name: 'Alice',
            inviteToken: 'alice123456',
            defaultCurrency: 'ILS',
            language: 'en',
            isActive: true,
            isAdmin: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    } as any);
    queryClient.setQueryData(queryKeys.groups, mockGroupsSeed);
});

describe('AddExpenseScreen — stale / missing group context', () => {
    it('shows the group pill and loads members after falling back from a stale route id', async () => {
        const { findByTestId, findByText } = renderWithQuery(<AddExpenseScreen />);
        expect(await findByTestId('add-expense-group-pill')).toBeTruthy();
        await waitFor(
            () => expect(getGroupMembers).toHaveBeenCalledWith('g-live'),
            { timeout: 5000 },
        );
        expect(await findByTestId('combined-payer-split')).toBeTruthy();
    });
});
