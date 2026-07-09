import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithQuery } from '../../helpers/renderWithQuery';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, setOptions: jest.fn() }),
        // Opened from "+": seeded with the favorite group g1.
        useRoute: () => ({ params: { groupId: 'g1' } }),
        useFocusEffect: (cb: () => void) => cb(),
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

jest.mock('../../../services/groups.service', () => ({
    getGroupMembers: jest.fn(async (groupId: string) =>
        groupId === 'g2'
            ? [
                  { id: 'm3', groupId: 'g2', userId: 'u1', role: 'member', isActive: true, joinedAt: new Date() },
                  { id: 'm4', groupId: 'g2', userId: 'u3', role: 'member', isActive: true, joinedAt: new Date() },
              ]
            : [
                  { id: 'm1', groupId: 'g1', userId: 'u1', role: 'member', isActive: true, joinedAt: new Date() },
                  { id: 'm2', groupId: 'g1', userId: 'u2', role: 'member', isActive: true, joinedAt: new Date() },
              ],
    ),
    getGroupById: jest.fn(),
}));

jest.mock('../../../services/users.service', () => ({
    fetchGroupUsers: jest.fn(async (groupId: string) =>
        groupId === 'g2'
            ? [
                  { id: 'u1', name: 'Alice', email: 'a@x.com', inviteToken: 'alice123456', defaultCurrency: 'EUR', language: 'en', createdAt: new Date(), updatedAt: new Date(), isActive: true, isAdmin: false },
                  { id: 'u3', name: 'Carol', email: 'c@x.com', inviteToken: 'carol1234567', defaultCurrency: 'EUR', language: 'en', createdAt: new Date(), updatedAt: new Date(), isActive: true, isAdmin: false },
              ]
            : [
                  { id: 'u1', name: 'Alice', email: 'a@x.com', inviteToken: 'alice123456', defaultCurrency: 'USD', language: 'en', createdAt: new Date(), updatedAt: new Date(), isActive: true, isAdmin: false },
                  { id: 'u2', name: 'Bob', email: 'b@x.com', inviteToken: 'bob12345678', defaultCurrency: 'USD', language: 'en', createdAt: new Date(), updatedAt: new Date(), isActive: true, isAdmin: false },
              ],
    ),
}));

import { AddExpenseScreen } from '../../../screens/expenses/AddExpenseScreen';
import { createExpense } from '../../../services/expenses.service';
import { useAppStore } from '../../../store';
import { queryClient } from '../../../lib/queryClient';
import { queryKeys } from '../../../hooks/queries/keys';

const mockCreateExpense = createExpense as jest.MockedFunction<typeof createExpense>;

const groupsSeed = [
    {
        id: 'g1', name: 'Trip', defaultCurrency: 'USD', groupType: 'trip',
        inviteToken: 'trip1234567', createdBy: 'u1', isActive: true,
        isArchivedByMe: false, isAutoArchived: false, createdAt: new Date(), updatedAt: new Date(),
        members: [
            { userId: 'u1', displayName: 'Alice', isActive: true },
            { userId: 'u2', displayName: 'Bob', isActive: true },
        ],
    },
    {
        id: 'g2', name: 'Flat', defaultCurrency: 'EUR', groupType: 'general',
        inviteToken: 'flat1234567', createdBy: 'u1', isActive: true,
        isArchivedByMe: false, isAutoArchived: false, createdAt: new Date(), updatedAt: new Date(),
        members: [
            { userId: 'u1', displayName: 'Alice', isActive: true },
            { userId: 'u3', displayName: 'Carol', isActive: true },
        ],
    },
];

beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockCreateExpense.mockReset();
    mockCreateExpense.mockResolvedValue({ id: 'e1' } as any);
    useAppStore.setState({
        language: 'en',
        favoriteGroupId: 'g1',
        currentUser: {
            id: 'u1', email: 'a@x.com', name: 'Alice', inviteToken: 'alice123456',
            defaultCurrency: 'USD', language: 'en', isActive: true, isAdmin: false,
            createdAt: new Date(), updatedAt: new Date(),
        },
    } as any);
    queryClient.clear();
    queryClient.setQueryData(queryKeys.groups, groupsSeed);
});

describe('AddExpenseScreen — editable group control', () => {
    it('shows the seeded favorite group in the pill', async () => {
        const { findByTestId, findByText } = renderWithQuery(<AddExpenseScreen />);
        const pill = await findByTestId('add-expense-group-pill');
        expect(pill).toBeTruthy();
        expect(await findByText('Trip')).toBeTruthy();
    });

    it('switching group updates the currency default (USD → EUR)', async () => {
        const { findByTestId, findByText } = renderWithQuery(<AddExpenseScreen />);
        // Currency pill starts at USD (g1 default).
        expect(await findByText('USD')).toBeTruthy();
        fireEvent.press(await findByTestId('add-expense-group-pill'));
        fireEvent.press(await findByTestId('group-picker-row-g2'));
        await waitFor(async () => {
            expect(await findByText('EUR')).toBeTruthy();
        });
    });

    it('publishes to the switched group via the mutation (fast path)', async () => {
        const { findByTestId } = renderWithQuery(<AddExpenseScreen />);
        fireEvent.press(await findByTestId('add-expense-group-pill'));
        fireEvent.press(await findByTestId('group-picker-row-g2'));
        fireEvent.changeText(await findByTestId('description-input'), 'Rent');
        fireEvent.changeText(await findByTestId('amount-display'), '90');
        await waitFor(async () =>
            expect((await findByTestId('add-expense-submit')).props.accessibilityState?.disabled).toBe(false),
        );
        fireEvent.press(await findByTestId('add-expense-submit'));
        await waitFor(() => expect(mockCreateExpense).toHaveBeenCalled());
        const dto = mockCreateExpense.mock.calls[0][0] as any;
        expect(dto.groupId).toBe('g2');
        expect(dto.currency).toBe('EUR');
        // Split defaults recomputed for g2's members (u1 + u3), not g1's.
        expect(dto.splits.map((s: any) => s.userId).sort()).toEqual(['u1', 'u3']);
    });

    it('keeps all expense controls editable (payer/split, date, currency, receipt)', async () => {
        const { findByTestId } = renderWithQuery(<AddExpenseScreen />);
        // Group pill (this feature) + every pre-existing control still render.
        expect(await findByTestId('add-expense-group-pill')).toBeTruthy();
        expect(await findByTestId('meta-date')).toBeTruthy();
        expect(await findByTestId('meta-receipt')).toBeTruthy();
        const amount = await findByTestId('amount-display');
        expect(amount.props.editable).not.toBe(false);
        const description = await findByTestId('description-input');
        expect(description.props.editable).not.toBe(false);
    });
});
