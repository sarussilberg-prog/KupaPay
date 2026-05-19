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

jest.mock('../../../services/expenses.service', () => ({
    createExpense: jest.fn(),
}));

jest.mock('../../../services/groups.service', () => ({
    getGroupMembers: jest.fn().mockResolvedValue([
        { id: 'm1', groupId: 'g1', userId: 'u1', role: 'member', isActive: true, joinedAt: new Date() },
    ]),
}));

jest.mock('../../../services/users.service', () => ({
    fetchUsers: jest.fn().mockResolvedValue([
        { id: 'u1', name: 'Alice', email: 'a@x.com', defaultCurrency: 'USD', language: 'en', createdAt: new Date(), updatedAt: new Date() },
    ]),
}));

import { AddExpenseScreen } from '../../../screens/expenses/AddExpenseScreen';
import { createExpense } from '../../../services/expenses.service';
import { useAppStore } from '../../../store';

const mockCreateExpense = createExpense as jest.MockedFunction<typeof createExpense>;

beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockCreateExpense.mockReset();
    useAppStore.setState({
        currentUser: {
            id: 'u1',
            email: 'a@x.com',
            name: 'Alice',
            defaultCurrency: 'USD',
            language: 'en',
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    });
});

describe('AddExpenseScreen', () => {
    it('renders the description and amount inputs', async () => {
        const { findByText } = render(<AddExpenseScreen />);
        expect(await findByText('expenses.description')).toBeTruthy();
        expect(await findByText('expenses.amount')).toBeTruthy();
    });

    it('shows validation error for empty description', async () => {
        const { findByText, findAllByText } = render(<AddExpenseScreen />);
        const addButtons = await findAllByText('expenses.addExpense');
        fireEvent.press(addButtons[addButtons.length - 1]);
        expect(await findByText('expenses.descriptionRequired')).toBeTruthy();
        expect(mockCreateExpense).not.toHaveBeenCalled();
    });

    it('shows validation error for invalid amount', async () => {
        const { findByText, getByPlaceholderText, findAllByText } = render(<AddExpenseScreen />);
        await findByText('expenses.description');
        fireEvent.changeText(getByPlaceholderText('expenses.enterDescription'), 'Coffee');
        const addButtons = await findAllByText('expenses.addExpense');
        fireEvent.press(addButtons[addButtons.length - 1]);
        expect(await findByText('expenses.invalidAmount')).toBeTruthy();
    });

    it('calls createExpense with proper DTO', async () => {
        mockCreateExpense.mockResolvedValueOnce({ id: 'e1' } as any);
        const { findByText, getByPlaceholderText, findAllByText } = render(<AddExpenseScreen />);
        await findByText('expenses.description');
        fireEvent.changeText(getByPlaceholderText('expenses.enterDescription'), 'Coffee');
        fireEvent.changeText(getByPlaceholderText('0.00'), '10');
        const addButtons = await findAllByText('expenses.addExpense');
        fireEvent.press(addButtons[addButtons.length - 1]);
        await waitFor(() => expect(mockCreateExpense).toHaveBeenCalled());
        expect(mockCreateExpense).toHaveBeenCalledWith(
            expect.objectContaining({
                groupId: 'g1',
                description: 'Coffee',
                amount: 10,
                paidBy: 'u1',
            })
        );
    });
});
